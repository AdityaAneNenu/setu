import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  const focusAreas = [
    { icon: '🎓', title: 'Education' },
    { icon: '🏥', title: 'Healthcare' },
    { icon: '🚿', title: 'Sanitation' },
    { icon: '⚡', title: 'Electricity' },
    { icon: '📡', title: 'Connectivity' },
    { icon: '💧', title: 'Water Supply' },
    { icon: '🛠️', title: 'Skill Development' },
    { icon: '💼', title: 'Livelihood' },
  ];

  const keyFeatures = [
    {
      icon: '📱',
      title: 'Mobile Friendly',
      description: 'Access from any device: desktop, tablet, or mobile phone.',
    },
    {
      icon: '🎤',
      title: 'Voice Input',
      description: 'Submit complaints using voice in Hindi and other regional languages.',
    },
    {
      icon: '🔐',
      title: 'Secure System',
      description: 'Role-based access control with voice verification for authenticity.',
    },
    {
      icon: '📈',
      title: 'Real-time Analytics',
      description: 'Track development progress with interactive charts and reports.',
    },
    {
      icon: '🌐',
      title: 'Multi-language',
      description: 'Available in English, Hindi, and other regional languages.',
    },
    {
      icon: '✉️',
      title: 'Email Notifications',
      description: 'Get updates on complaint status and resolution progress.',
    },
  ];

  return (
    <main className={styles.main}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroOverlay}></div>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            <span className={styles.heroTitleWhite}>Transform SC-Majority Villages into </span>
            <br />
            <span className={styles.heroTitleYellow}>Adarsh Grams</span>
          </h1>
          
          <p className={styles.heroSubtitle}>
            Supporting PM-AJAY&apos;s mission to holistically develop Scheduled Caste majority villages through data-driven gap identification and systematic infrastructure development.
          </p>
          
          <div className={styles.badge}>
            <span className={styles.badgeText}>Pradhan Mantri Anusuchit Jaati Abhyudaya Yojana (PM-AJAY)</span>
          </div>
          
          <div className={styles.ctaButtons}>
            <Link href="/login" className={`btn btn-primary btn-lg ${styles.ctaBtn}`}>
              <span>Get Started</span>
              <span>→</span>
            </Link>
            <Link href="/public-dashboard" className={`btn btn-secondary btn-lg ${styles.ctaBtn}`}>
              <span>Explore the Public Dashboard</span>
              <span>→</span>
            </Link>
          </div>
        </div>
        
        <div className={styles.scrollIndicator}>
          <div className={styles.scrollIcon}>↓</div>
        </div>
      </section>

      <section className={styles.impactStrip}>
        <div className={styles.container}>
          <div className={styles.impactGrid}>
            <div className={styles.impactItem}>
              <span className={styles.impactNumber}>500+</span>
              <span className={styles.impactLabel}>Villages Covered</span>
            </div>
            <div className={styles.impactItem}>
              <span className={styles.impactNumber}>2,500+</span>
              <span className={styles.impactLabel}>Gaps Reported</span>
            </div>
            <div className={styles.impactItem}>
              <span className={styles.impactNumber}>1,200+</span>
              <span className={styles.impactLabel}>Resolved Projects</span>
            </div>
            <div className={styles.impactItem}>
              <span className={styles.impactNumber}>85%</span>
              <span className={styles.impactLabel}>Satisfaction Score</span>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className={styles.section}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>About the Initiative</h2>
          <div className={styles.aboutText}>
            <p className={styles.sectionText}>
              The <strong>Pradhan Mantri Anusuchit Jaati Abhyudaya Yojana (PM-AJAY)</strong> aims to holistically develop Scheduled Caste (SC) majority villages into <strong>Adarsh Grams (Model Villages)</strong> by addressing critical gaps in infrastructure and services.
            </p>
            <p className={styles.sectionText}>
              Our platform supports this mission by providing a comprehensive digital solution to identify infrastructure gaps, track development projects, and monitor progress across key focus areas including education, healthcare, sanitation, connectivity, drinking water, electricity, skill development, and livelihood opportunities.
            </p>
          </div>
          
          <div className={styles.grid4}>
            {focusAreas.map((area, idx) => (
              <div key={idx} className={styles.focusCard}>
                <div className={styles.focusIcon}>{area.icon}</div>
                <div className={styles.focusTitle}>{area.title}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className={`${styles.section} ${styles.sectionGray}`}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>How It Works</h2>
          <p className={styles.sectionSubtitle}>
            A simple 4-step process to identify gaps and transform your village into an Adarsh Gram
          </p>
          <div className={styles.grid2}>
            {[
              {
                step: '01',
                title: 'Report Gaps',
                description: 'Upload images, voice recordings, or text to report infrastructure gaps in villages',
              },
              {
                step: '02',
                title: 'AI Analysis',
                description: 'Our AI system analyzes submissions and categorizes gaps by type and severity',
              },
              {
                step: '03',
                title: 'Track Progress',
                description: 'Monitor resolution progress through our comprehensive dashboard',
              },
              {
                step: '04',
                title: 'Verify Resolution',
                description: 'Voice verification ensures authentic closure of resolved issues',
              },
            ].map((item, idx) => (
              <div key={idx} className={styles.stepCard}>
                <div className={styles.stepNumber}>{item.step}</div>
                <h3 className={styles.stepTitle}>{item.title}</h3>
                <p className={styles.stepDescription}>{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.section}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Key Features</h2>
          <div className={styles.grid3}>
            {keyFeatures.map((item, idx) => (
              <div key={idx} className={styles.featureCard}>
                <div className={styles.featureIcon}>{item.icon}</div>
                <h3 className={styles.featureTitle}>{item.title}</h3>
                <p className={styles.featureDescription}>{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={`${styles.section} ${styles.sectionDark}`}>
        <div className={styles.container}>
          <div className={styles.ctaSection}>
            <h2 className={styles.ctaTitle}>Ready to Make a Difference?</h2>
            <p className={styles.ctaDescription}>
              Join the movement to transform villages into model communities
            </p>
            <div className={styles.ctaButtons}>
              <Link href="/login" className="btn btn-primary btn-lg">
                Get Started
              </Link>
              <Link href="/public-dashboard" className="btn btn-secondary btn-lg">
                Explore Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <p>© {new Date().getFullYear()} SETU - Village Development Tracker | PM-AJAY Initiative | Government of India</p>
        </div>
      </footer>
    </main>
  );
}
