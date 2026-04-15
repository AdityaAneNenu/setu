import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { fonts } from '../theme';
import { villagesApi, gapsApi } from '../services/api';
import { analyzeMedia } from '../services/aiService';
import { uploadService } from '../services/cloudinaryService';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { parseArray } from '../utils/safeJSON';
import { formatErrorForDisplay } from '../utils/errorDisplay';

// Gap Type Categories - matching backend API
const getGapTypes = (t) => [
  { id: 'water', label: t('gapForm.waterSupply'), icon: 'water' },
  { id: 'road', label: t('gapForm.roadInfrastructure'), icon: 'trail-sign' },
  { id: 'sanitation', label: t('gapForm.sanitation'), icon: 'sparkles' },
  { id: 'electricity', label: t('gapForm.electricity'), icon: 'flash' },
  { id: 'education', label: t('gapForm.education'), icon: 'school' },
  { id: 'health', label: t('gapForm.healthcare'), icon: 'medical' },
  { id: 'housing', label: t('gapForm.housing'), icon: 'home' },
  { id: 'agriculture', label: t('gapForm.agriculture'), icon: 'leaf' },
  { id: 'connectivity', label: t('gapForm.connectivity'), icon: 'wifi' },
  { id: 'employment', label: t('gapForm.employment'), icon: 'briefcase' },
  { id: 'community_center', label: t('gapForm.communityCenter'), icon: 'people' },
  { id: 'drainage', label: t('gapForm.drainage'), icon: 'water-outline' },
  { id: 'other', label: t('gapForm.other'), icon: 'ellipsis-horizontal' },
];

// Severity Levels
const getSeverityLevels = (t) => [
  { id: 'low', label: t('gapForm.low'), color: '#4CAF50', description: t('gapForm.lowDesc') },
  { id: 'medium', label: t('gapForm.medium'), color: '#FF9800', description: t('gapForm.mediumDesc') },
  { id: 'high', label: t('gapForm.high'), color: '#F44336', description: t('gapForm.highDesc') },
];

export default function GapFormScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const GAP_TYPES = getGapTypes(t);
  const SEVERITY_LEVELS = getSeverityLevels(t);
  const { mediaUri, mediaType, language, prefill } = route.params || {};
  
  const [villages, setVillages] = useState([]);
  const [selectedVillage, setSelectedVillage] = useState('');
  const [selectedGapType, setSelectedGapType] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('medium');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(true);
  
  // AI Processing states
  const [processingAI, setProcessingAI] = useState(false);
  const [aiProcessed, setAiProcessed] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [uploadedMediaUrl, setUploadedMediaUrl] = useState(null);
  
  // GPS states
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  
  // Success Modal states
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const safeLabel = (key, fallback) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  useEffect(() => {
    loadVillages();
    captureGPS();
  }, []);
  
  // AI Processing Effect - runs when media is present
  useEffect(() => {
    if (prefill) {
      // AI already processed in AudioProcessingScreen — use prefill data
      setSelectedGapType(prefill.gap_type || '');
      setSelectedSeverity(prefill.severity || 'medium');
      setDescription(prefill.description || '');
      setUploadedMediaUrl(prefill.audioUrl || prefill.imageUrl || null);
      setAiProcessed(true);
    } else if (mediaUri && !aiProcessed) {
      processMediaWithAI();
    }
  }, [mediaUri]);
  
  const processMediaWithAI = async () => {
    setProcessingAI(true);
    try {
      // Step 1: Upload media to Cloudinary first
      const tempId = `temp_${Date.now()}`;
      let mediaUrl;
      
      if (mediaType === 'audio') {
        mediaUrl = await uploadService.uploadAudio(mediaUri, tempId);
      } else if (mediaType === 'image') {
        mediaUrl = await uploadService.uploadImage(mediaUri, tempId);
      }
      
      setUploadedMediaUrl(mediaUrl);
      
      // Step 2: Call AI analysis API (use original local URI, not Cloudinary URL)
      const aiResult = await analyzeMedia(mediaUri, mediaType, language || 'hi');
      
      if (aiResult.success) {
        setAiSuggestion(aiResult);
        // Auto-fill form with AI suggestions
        setSelectedGapType(aiResult.gap_type);
        setSelectedSeverity(aiResult.severity);
        setDescription(aiResult.description);
        
        Alert.alert(
          t('gapForm.aiComplete'),
          t('gapForm.aiCompleteMsg', { severity: aiResult.severity, gapType: aiResult.gap_type }),
          [{ text: t('common.ok') }]
        );
      } else {
        // AI failed, but media is uploaded - user can fill manually
        const friendly = formatErrorForDisplay(aiResult.error, {
          action: 'analyze media',
          fallback: t('gapForm.aiFailedMsg'),
        });
        Alert.alert(
          t('gapForm.aiFailed'),
          friendly.message,
          [{ text: t('common.ok') }]
        );
      }
    } catch (error) {
      console.error('AI processing error:', error);
      const friendly = formatErrorForDisplay(error, {
        action: 'process media',
        fallback: t('gapForm.processingErrorMsg'),
      });
      Alert.alert(
        t('gapForm.processingError'),
        friendly.message,
        [{ text: t('common.ok') }]
      );
    } finally {
      setProcessingAI(false);
      setAiProcessed(true);
    }
  };

  const loadVillages = async () => {
    try {
      const data = await villagesApi.getAll();
      if (data && data.length > 0) {
        setVillages(data);
      } else {
        Alert.alert(t('gapForm.noVillages'), t('gapForm.noVillagesMsg'));
      }
    } catch (error) {
      console.error('Failed to load villages:', error);
      const friendly = formatErrorForDisplay(error, {
        action: 'load villages',
        fallback: t('gapForm.connectionErrorMsg'),
      });
      Alert.alert(
        t('gapForm.connectionError'),
        friendly.message,
        [
          { text: t('common.retry'), onPress: () => loadVillages() },
          { text: t('common.cancel') },
        ]
      );
    } finally {
      setLoadingVillages(false);
    }
  };

  const captureGPS = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Location permission denied');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
    } catch (error) {
      console.warn('GPS capture failed:', error.message);
    } finally {
      setGpsLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedVillage) {
      Alert.alert(t('gapForm.requiredField'), t('gapForm.selectVillage'));
      return;
    }
    if (!selectedGapType) {
      Alert.alert(t('gapForm.requiredField'), t('gapForm.selectGapType'));
      return;
    }

    setLoading(true);

    // Find village name for the selected village
    const village = villages.find(v => v.id === selectedVillage);
    const villageName = village ? village.name : '';

    // Determine input method
    let inputMethod = 'text';
    if (mediaType === 'audio') inputMethod = 'voice';
    else if (mediaType === 'image') inputMethod = 'image';

    // Prepare submission data
    const submissionData = {
      village_id: selectedVillage,
      village_name: villageName,
      gap_type: selectedGapType,
      severity: selectedSeverity,
      description: description.trim() || '',
      input_method: inputMethod,
      latitude: latitude,
      longitude: longitude,
    };

    try {
      
      // If media was already uploaded during AI processing, use that URL
      // Otherwise upload now (fallback if AI processing failed)
      if (uploadedMediaUrl) {
        if (mediaType === 'audio') {
          submissionData.audioUrl = uploadedMediaUrl;
        } else if (mediaType === 'image') {
          submissionData.imageUrl = uploadedMediaUrl;
        }
      } else if (mediaUri) {
        // Upload media if not already uploaded
        if (mediaType === 'audio') {
          submissionData.audioUri = mediaUri;
        } else if (mediaType === 'image') {
          submissionData.imageUri = mediaUri;
        }
      }

      // Submit to Firebase Firestore (and Django via dual-write)
      const result = await gapsApi.submit(submissionData);

      // Show custom success modal
      setSuccessData({
        gap_type: submissionData.gap_type,
        severity: submissionData.severity,
        village_name: villages.find(v => v.id === submissionData.village_id)?.name || '',
      });
      setShowSuccess(true);
      
      // Trigger success animation
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (error) {
      console.error('Submission error:', error);
      // Save to offline queue for later sync
      try {
        const pending = await AsyncStorage.getItem('pendingSubmissions');
        const queue = parseArray(pending);
        queue.push({
          ...submissionData,
          _savedAt: new Date().toISOString(),
          _mediaUri: mediaUri || null,
          _mediaType: mediaType || null,
        });
        await AsyncStorage.setItem('pendingSubmissions', JSON.stringify(queue));
        Alert.alert(
          t('gapForm.savedOffline'),
          t('gapForm.savedOfflineMsg'),
          [{ text: t('common.ok'), onPress: () => navigation.navigate('Home') }]
        );
      } catch (saveError) {
        const friendly = formatErrorForDisplay(error, {
          action: 'submit your report',
          fallback: t('gapForm.submitFailed'),
        });
        Alert.alert(
          t('common.error'),
          friendly.message
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundGray }]}>
      <StatusBar barStyle={colors.statusBarStyle} backgroundColor={colors.backgroundGray} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('gapForm.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* AI Processing Banner */}
        {processingAI && (
          <View style={[styles.mediaBanner, { backgroundColor: isDark ? '#3A2A12' : '#FFF8E1', borderColor: isDark ? '#6E4B1A' : '#FFE0B2' }]}>
            <ActivityIndicator color="#FA4A0C" size="small" />
            <View style={styles.mediaInfo}>
              <Text style={[styles.mediaTitle, { color: colors.text }]}>
                {t('gapForm.aiProcessing')}
              </Text>
              <Text style={[styles.mediaSubtitle, { color: colors.textLight }]}>
                {t('gapForm.analysingMedia', { mediaType })}
              </Text>
            </View>
          </View>
        )}
        
        {/* AI Success Banner */}
        {aiProcessed && aiSuggestion?.success && (
          <View style={[styles.mediaBanner, { backgroundColor: isDark ? '#163321' : '#E8F5E9', borderColor: isDark ? '#2A5A3D' : '#C8E6C9' }]}>
            <View style={styles.mediaIconCircle}>
              <Ionicons name="sparkles" size={24} color="#4CAF50" />
            </View>
            <View style={styles.mediaInfo}>
              <Text style={[styles.mediaTitle, { color: colors.text }]}>
                {t('gapForm.aiAnalysisComplete')}
              </Text>
              <Text style={[styles.mediaSubtitle, { color: colors.textLight }]}>
                {t('gapForm.formAutoFilled')}
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
          </View>
        )}
        
        {/* Media Info Banner */}
        {mediaUri && (
          <View style={[styles.mediaBanner, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <View style={[styles.mediaIconCircle, { backgroundColor: isDark ? '#3D2800' : '#FFF3E0' }]}>
              <Ionicons
                name={mediaType === 'audio' ? 'musical-notes' : 'image'}
                size={24}
                color="#FA4A0C"
              />
            </View>
            <View style={styles.mediaInfo}>
              <Text style={[styles.mediaTitle, { color: colors.text }]}>
                {t('gapForm.mediaAttached', { mediaType: mediaType === 'audio' ? t('gapForm.audioRecording') : t('gapForm.photoAttached') })}
              </Text>
              <Text style={[styles.mediaSubtitle, { color: colors.textLight }]}>
                {mediaType === 'audio' && language ? t('gapForm.langLabel', { language }) : t('gapForm.readyForSubmission')}
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
          </View>
        )}

        {/* Village Selection */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('gapForm.villageLabelReq')}</Text>
          <Text style={[styles.sectionDesc, { color: colors.textLight }]}>{t('gapForm.villagePlaceholder')}</Text>
          
          {loadingVillages ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />
          ) : (
            <View style={styles.villageGrid}>
              {villages.map((village) => (
                <TouchableOpacity
                  key={village.id}
                  style={[
                    styles.villageChip,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    selectedVillage === village.id && styles.villageChipSelected,
                  ]}
                  onPress={() => setSelectedVillage(village.id)}
                >
                  <Text
                    style={[
                      styles.villageChipText,
                      { color: colors.text },
                      selectedVillage === village.id && styles.villageChipTextSelected,
                    ]}
                  >
                    {village.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Gap Type Selection */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('gapForm.gapTypeLabelReq')}</Text>
          <Text style={[styles.sectionDesc, { color: colors.textLight }]}>{t('gapForm.gapTypePlaceholder')}</Text>
          
          <View style={styles.gapTypeGrid}>
            {GAP_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.gapTypeCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  selectedGapType === type.id && styles.gapTypeCardSelected,
                ]}
                onPress={() => setSelectedGapType(type.id)}
              >
                <View
                  style={[
                    styles.gapTypeIconCircle,
                    { backgroundColor: isDark ? colors.surface : '#F5F5F8' },
                    selectedGapType === type.id && styles.gapTypeIconCircleSelected,
                  ]}
                >
                  <Ionicons
                    name={type.icon}
                    size={24}
                    color={selectedGapType === type.id ? '#FA4A0C' : colors.textMuted}
                  />
                </View>
                <Text
                  style={[
                    styles.gapTypeLabel,
                    { color: colors.textLight },
                    selectedGapType === type.id && styles.gapTypeLabelSelected,
                  ]}
                  numberOfLines={2}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Severity Selection */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('gapForm.severityLabelReq')}</Text>
          <Text style={[styles.sectionDesc, { color: colors.textLight }]}>{t('gapForm.severityPlaceholder')}</Text>
          
          <View style={styles.severityContainer}>
            {SEVERITY_LEVELS.map((level) => (
              <TouchableOpacity
                key={level.id}
                style={[
                  styles.severityCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  selectedSeverity === level.id && {
                    borderColor: level.color,
                    backgroundColor: `${level.color}10`,
                  },
                ]}
                onPress={() => setSelectedSeverity(level.id)}
              >
                <View style={styles.severityRadio}>
                  {selectedSeverity === level.id && (
                    <View style={[styles.severityRadioInner, { backgroundColor: level.color }]} />
                  )}
                </View>
                <View style={styles.severityInfo}>
                  <Text
                    style={[
                      styles.severityLabel,
                      selectedSeverity === level.id && { color: level.color },
                    ]}
                  >
                    {level.label}
                  </Text>
                  <Text style={[styles.severityDesc, { color: colors.textLight }]}>{level.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Additional Description */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('gapForm.detailsLabel')}</Text>
          <Text style={[styles.sectionDesc, { color: colors.textLight }]}>
            {t('gapForm.detailsHint')}
          </Text>
          
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder={t('gapForm.detailsPlaceholder')}
            placeholderTextColor={colors.textPlaceholder}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: colors.buttonPrimaryBg }, (loading || processingAI) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading || processingAI}
        >
          {loading ? (
            <ActivityIndicator color={colors.buttonPrimaryText} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={colors.buttonPrimaryText} style={{ marginRight: 8 }} />
              <Text style={[styles.submitButtonText, { color: colors.buttonPrimaryText }]}> 
                {processingAI ? t('gapForm.processingWithAI') : t('gapForm.submitReport')}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Success Modal */}
      <Modal
        visible={showSuccess}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowSuccess(false);
          navigation.navigate('Home');
        }}
      >
        <View style={styles.successModalOverlay}>
          <View style={[styles.successModalContent, { backgroundColor: colors.card }]}>
            {/* Animated Success Checkmark */}
            <Animated.View style={[styles.successCircle, { transform: [{ scale: scaleAnim }] }]}>
              <View style={styles.successInnerCircle}>
                <Ionicons name="checkmark" size={44} color="#FFFFFF" />
              </View>
            </Animated.View>

            <Text style={[styles.successTitle, { color: colors.text }]}>{t('common.success')}</Text>
            <Text style={[styles.successMessage, { color: colors.textLight }]}>{t('gapForm.successMsg')}</Text>

            {/* Gap Summary Card */}
            <Animated.View style={[styles.successSummaryCard, { opacity: fadeAnim, backgroundColor: isDark ? colors.surface : '#F8F9FA' }]}>
              {successData?.gap_type && (
                <View style={styles.summaryRow}>
                  <Ionicons name="layers-outline" size={18} color="#FA4A0C" />
                  <Text style={[styles.summaryLabel, { color: colors.textLight }]}>{safeLabel('gapForm.type', 'Type')}:</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>
                    {GAP_TYPES.find(g => g.id === successData.gap_type)?.label || successData.gap_type}
                  </Text>
                </View>
              )}
              {successData?.severity && (
                <View style={styles.summaryRow}>
                  <Ionicons name="alert-circle-outline" size={18} color={
                    successData.severity === 'high' ? '#F44336' : 
                    successData.severity === 'medium' ? '#FF9800' : '#4CAF50'
                  } />
                  <Text style={[styles.summaryLabel, { color: colors.textLight }]}>{safeLabel('gapForm.severity', 'Severity')}:</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>
                    {SEVERITY_LEVELS.find(s => s.id === successData.severity)?.label || successData.severity}
                  </Text>
                </View>
              )}
              {successData?.village_name && (
                <View style={styles.summaryRow}>
                  <Ionicons name="location-outline" size={18} color="#4CAF50" />
                  <Text style={[styles.summaryLabel, { color: colors.textLight }]}>{safeLabel('gapForm.village', 'Village')}:</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>{successData.village_name}</Text>
                </View>
              )}
            </Animated.View>

            {/* Action Button */}
            <TouchableOpacity
              style={[styles.successButton, { backgroundColor: colors.buttonPrimaryBg }]}
              onPress={() => {
                setShowSuccess(false);
                navigation.navigate('Home');
              }}
            >
              <Ionicons name="home-outline" size={20} color={colors.buttonPrimaryText} style={{ marginRight: 8 }} />
              <Text style={[styles.successButtonText, { color: colors.buttonPrimaryText }]}>{t('common.backToHome')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  backButton: {
    padding: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: '#000000',
  },
  placeholder: {
    width: 24,
  },
  scrollView: {
    flex: 1,
  },
  mediaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginHorizontal: 24,
    marginTop: 8,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  mediaIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaInfo: {
    flex: 1,
    marginLeft: 12,
  },
  mediaTitle: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: '#000000',
    marginBottom: 4,
  },
  mediaSubtitle: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: '#888888',
  },
  section: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: '#000000',
    marginBottom: 6,
  },
  sectionDesc: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#666666',
    marginBottom: 16,
  },
  villageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  villageChip: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    margin: 4,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  villageChipSelected: {
    backgroundColor: '#FA4A0C',
    borderColor: '#FA4A0C',
  },
  villageChipText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: '#000000',
  },
  villageChipTextSelected: {
    color: '#FFFFFF',
  },
  gapTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  gapTypeCard: {
    width: '30%',
    backgroundColor: '#FFFFFF',
    margin: 6,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F0F0F0',
  },
  gapTypeCardSelected: {
    borderColor: '#FA4A0C',
    backgroundColor: '#FFF8F5',
  },
  gapTypeIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F5F5F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  gapTypeIconCircleSelected: {
    backgroundColor: '#FFE8DC',
  },
  gapTypeLabel: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: '#666666',
    textAlign: 'center',
  },
  gapTypeLabelSelected: {
    color: '#FA4A0C',
    fontFamily: fonts.semiBold,
  },
  severityContainer: {
    gap: 12,
  },
  severityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F0F0F0',
  },
  severityRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D0D0D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  severityRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  severityInfo: {
    flex: 1,
  },
  severityLabel: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: '#000000',
    marginBottom: 2,
  },
  severityDesc: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: '#888888',
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: '#000000',
    minHeight: 120,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  submitButton: {
    backgroundColor: '#000000',
    marginHorizontal: 24,
    marginTop: 32,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: fonts.semiBold,
  },
  // Success Modal Styles
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successModalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  successCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successInnerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  successSummaryCard: {
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#888888',
    marginLeft: 10,
    marginRight: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: '#000000',
    flex: 1,
  },
  successButton: {
    backgroundColor: '#FA4A0C',
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    width: '100%',
  },
  successButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },
});
