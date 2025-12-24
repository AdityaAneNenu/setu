# Test AssemblyAI Integration
# Install the assemblyai package by executing the command "pip install assemblyai"

import assemblyai as aai

aai.settings.api_key = "ceb42e089f4c4e72877d50a64e9fe2b9"

# audio_file = "./local_file.mp3"
audio_file = "https://assembly.ai/wildfires.mp3"

config = aai.TranscriptionConfig(speech_model=aai.SpeechModel.best)

transcript = aai.Transcriber(config=config).transcribe(audio_file)

if transcript.status == aai.TranscriptStatus.error:
    raise RuntimeError(f"Transcription failed: {transcript.error}")

print("AssemblyAI Transcription Test")
print("=" * 60)
print(transcript.text)
print("=" * 60)
print("\nTranscription successful! AssemblyAI is working correctly.")
