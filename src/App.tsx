import React, { useState } from 'react';
import { SchoolProvider, useSchool } from './context/SchoolContext';
import { Navbar } from './components/Navbar';
import { HeroBanner } from './components/HeroBanner';
import { KeyPillars } from './components/KeyPillars';
import { AboutSection } from './components/AboutSection';
import { AcademicPrograms } from './components/AcademicPrograms';
import { StudentLifeSection } from './components/StudentLifeSection';
import { FacultyTeam } from './components/FacultyTeam';
import { AcademicCalendarSection } from './components/AcademicCalendarSection';
import { NoticeBoard } from './components/NoticeBoard';
import { Testimonials } from './components/Testimonials';
import { StudentAchievements } from './components/StudentAchievements';
import { HouseChampionshipLeaderboard } from './components/HouseChampionshipLeaderboard';
import { ContactSection } from './components/ContactSection';
import { Footer } from './components/Footer';
import { WhatsAppButton } from './components/WhatsAppButton';
import { FAQSection } from './components/FAQSection';
import { CampusGallery } from './components/CampusGallery';
import { SchoolNewsBlogSection } from './components/SchoolNewsBlogSection';
import { ContributorsSection } from './components/ContributorsSection';
import { Compass, X } from 'lucide-react';
import { FloatingChatWidget } from './components/chat/FloatingChatWidget';
import { PageSection } from './types';

// Lazy-loaded Modals
const AdmissionsModal = React.lazy(() => import('./components/AdmissionsModal').then(m => ({ default: m.AdmissionsModal })));
const TuitionCalculatorModal = React.lazy(() => import('./components/TuitionCalculatorModal').then(m => ({ default: m.TuitionCalculatorModal })));
const ApplicationTrackerModal = React.lazy(() => import('./components/ApplicationTrackerModal').then(m => ({ default: m.ApplicationTrackerModal })));
const CareerAdvisorModal = React.lazy(() => import('./components/CareerAdvisorModal').then(m => ({ default: m.CareerAdvisorModal })));
const UserTourModal = React.lazy(() => import('./components/UserTourModal').then(m => ({ default: m.UserTourModal })));

// Lazy-loaded Subpages & Portals
const ProprietressPage = React.lazy(() => import('./components/ProprietressPage').then(m => ({ default: m.ProprietressPage })));
const PortalLoginPage = React.lazy(() => import('./components/PortalLoginPage').then(m => ({ default: m.PortalLoginPage })));
const AdminPortal = React.lazy(() => import('./components/portals/AdminPortal').then(m => ({ default: m.AdminPortal })));
const ProprietressPortal = React.lazy(() => import('./components/portals/ProprietressPortal').then(m => ({ default: m.ProprietressPortal })));
const HeadmistressPortal = React.lazy(() => import('./components/portals/HeadmistressPortal').then(m => ({ default: m.HeadmistressPortal })));
const ModeratorPortal = React.lazy(() => import('./components/portals/ModeratorPortal').then(m => ({ default: m.ModeratorPortal })));
const TutorPortal = React.lazy(() => import('./components/portals/TutorPortal').then(m => ({ default: m.TutorPortal })));
const StudentPortal = React.lazy(() => import('./components/portals/StudentPortal').then(m => ({ default: m.StudentPortal })));
const ParentPortal = React.lazy(() => import('./components/portals/ParentPortal').then(m => ({ default: m.ParentPortal })));

const PortalLoadingSkeleton: React.FC = () => (
  <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-6 text-center font-['Nunito',sans-serif]">
    <div className="w-14 h-14 rounded-2xl bg-blue-900 border-2 border-amber-400 flex items-center justify-center text-amber-300 font-black text-base mb-4 shadow-lg animate-pulse">
      SBS
    </div>
    <div className="text-base font-black text-slate-900 mb-1">Loading Academic Portal...</div>
    <div className="text-xs text-slate-500 max-w-xs">Connecting securely to Stanbax academic records.</div>
  </div>
);

const MainAppContent: React.FC = () => {
  const { 
    activeSection, 
    setActiveSection,
    landingSections,
    isAdminAuthenticated,
    isProprietressAuthenticated,
    isTutorAuthenticated,
    isStudentAuthenticated,
    isParentAuthenticated
  } = useSchool();

  // Modals state
  const [isAdmissionsOpen, setIsAdmissionsOpen] = useState(false);
  const [isTuitionCalcOpen, setIsTuitionCalcOpen] = useState(false);
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);
  const [isCareerAdvisorOpen, setIsCareerAdvisorOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [showTourPrompt, setShowTourPrompt] = useState(false);

  // Check if first-time visitor for walk-through tour
  React.useEffect(() => {
    try {
      const tourSeen = localStorage.getItem('stanbax_tour_completed');
      if (!tourSeen) {
        const timer = setTimeout(() => {
          setShowTourPrompt(true);
        }, 2200);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  const handleNavigate = (section: PageSection) => {
    if (section === 'contributors') {
      setActiveSection('home');
      setTimeout(() => {
        const target = document.getElementById('contributors');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      return;
    }
    setActiveSection(section);
    // Smooth scroll if section is on homepage
    const targetElement = document.getElementById(section);
    if (targetElement && (activeSection === 'home' || section === 'home' || !section.includes('portal'))) {
      targetElement.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Render Portals if user navigated to them
  if (activeSection === 'admin-portal') {
    return (
      <div className="min-h-screen bg-[#FDFBF7] text-neutral-900 font-['Nunito',sans-serif]">
        <React.Suspense fallback={<PortalLoadingSkeleton />}>
          <AdminPortal onBackToWebsite={() => handleNavigate('home')} />
        </React.Suspense>
        <FloatingChatWidget />
      </div>
    );
  }

  if (activeSection === 'proprietress-portal') {
    return (
      <div className="min-h-screen bg-[#FDFBF7] text-neutral-900 font-['Nunito',sans-serif]">
        <React.Suspense fallback={<PortalLoadingSkeleton />}>
          <ProprietressPortal onBackToWebsite={() => handleNavigate('home')} />
        </React.Suspense>
        <FloatingChatWidget />
      </div>
    );
  }

  if (activeSection === 'headmistress-portal') {
    return (
      <div className="min-h-screen bg-[#FDFBF7] text-neutral-900 font-['Nunito',sans-serif]">
        <React.Suspense fallback={<PortalLoadingSkeleton />}>
          <HeadmistressPortal onBackToWebsite={() => handleNavigate('home')} />
        </React.Suspense>
        <FloatingChatWidget />
      </div>
    );
  }

  if (activeSection === 'moderator-portal') {
    return (
      <div className="min-h-screen bg-[#FDFBF7] text-neutral-900 font-['Nunito',sans-serif]">
        <React.Suspense fallback={<PortalLoadingSkeleton />}>
          <ModeratorPortal onBackToWebsite={() => handleNavigate('home')} />
        </React.Suspense>
        <FloatingChatWidget />
      </div>
    );
  }

  if (activeSection === 'tutor-portal') {
    return (
      <div className="min-h-screen bg-[#FDFBF7] text-neutral-900 font-['Nunito',sans-serif]">
        <React.Suspense fallback={<PortalLoadingSkeleton />}>
          <TutorPortal onBackToWebsite={() => handleNavigate('home')} />
        </React.Suspense>
        <FloatingChatWidget />
      </div>
    );
  }

  if (activeSection === 'student-portal') {
    return (
      <div className="min-h-screen bg-[#FDFBF7] text-neutral-900 font-['Nunito',sans-serif]">
        <React.Suspense fallback={<PortalLoadingSkeleton />}>
          <StudentPortal onBackToWebsite={() => handleNavigate('home')} />
        </React.Suspense>
        <FloatingChatWidget />
      </div>
    );
  }

  if (activeSection === 'parent-portal') {
    return (
      <div className="min-h-screen bg-[#FDFBF7] text-neutral-900 font-['Nunito',sans-serif]">
        <React.Suspense fallback={<PortalLoadingSkeleton />}>
          <ParentPortal onBackToWebsite={() => handleNavigate('home')} />
        </React.Suspense>
        <FloatingChatWidget />
      </div>
    );
  }

  if (activeSection === 'portal-login') {
    return (
      <div className="min-h-screen bg-[#FDFBF7] text-neutral-900 font-['Nunito',sans-serif]">
        <React.Suspense fallback={<PortalLoadingSkeleton />}>
          <PortalLoginPage 
            onBackToWebsite={() => handleNavigate('home')}
            onLoginSuccess={(role) => {
              if (role === 'admin') setActiveSection('admin-portal');
              else if (role === 'proprietress') setActiveSection('proprietress-portal');
              else if (role === 'headmistress') setActiveSection('headmistress-portal');
              else if (role === 'moderator') setActiveSection('moderator-portal');
              else if (role === 'tutor') setActiveSection('tutor-portal');
              else if (role === 'student') setActiveSection('student-portal');
              else if (role === 'parent') setActiveSection('parent-portal');
            }}
          />
        </React.Suspense>
        <FloatingChatWidget />
      </div>
    );
  }

  if (activeSection === 'proprietress') {
    return (
      <div className="min-h-screen bg-[#FDFBF7] text-neutral-900 font-['Nunito',sans-serif] flex flex-col">
        <Navbar 
          onNavigate={handleNavigate}
          activeSection={activeSection}
          onOpenAdmissions={() => setIsAdmissionsOpen(true)}
          onOpenTuitionCalc={() => setIsTuitionCalcOpen(true)}
          onOpenStatusTracker={() => setIsTrackerOpen(true)}
        />
        <main className="flex-1">
          <React.Suspense fallback={<PortalLoadingSkeleton />}>
            <ProprietressPage
              onNavigate={handleNavigate}
              onOpenAdmissions={() => setIsAdmissionsOpen(true)}
              onOpenTuitionCalc={() => setIsTuitionCalcOpen(true)}
            />
          </React.Suspense>
        </main>
        <Footer 
          onNavigate={handleNavigate}
          onOpenAdmissions={() => setIsAdmissionsOpen(true)}
          onOpenTuitionCalc={() => setIsTuitionCalcOpen(true)}
          onOpenStatusTracker={() => setIsTrackerOpen(true)}
        />
        <WhatsAppButton />
        <FloatingChatWidget />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-neutral-900 flex flex-col font-['Nunito',sans-serif] selection:bg-red-600 selection:text-white">
      {/* Universal Header with School Crest and Uniform Colors */}
      <Navbar 
        onNavigate={handleNavigate}
        activeSection={activeSection}
        onOpenAdmissions={() => setIsAdmissionsOpen(true)}
        onOpenTuitionCalc={() => setIsTuitionCalcOpen(true)}
        onOpenStatusTracker={() => setIsTrackerOpen(true)}
        onOpenTour={() => setIsTourOpen(true)}
      />

      {/* Main Website Flow - Toggleable via Admin Dashboard */}
      <main className="flex-1">
        {landingSections?.hero !== false && (
          <div id="home">
            <HeroBanner 
              onNavigate={handleNavigate}
              onOpenAdmissions={() => setIsAdmissionsOpen(true)}
            />
          </div>
        )}

        {landingSections?.keyPillars !== false && (
          <KeyPillars />
        )}

        {landingSections?.about !== false && (
          <div id="about">
            <AboutSection onOpenAdmissions={() => setIsAdmissionsOpen(true)} />
          </div>
        )}

        {landingSections?.programs !== false && (
          <div id="programs">
            <AcademicPrograms onOpenAdmissions={() => setIsAdmissionsOpen(true)} />
          </div>
        )}

        {landingSections?.studentLife !== false && (
          <div id="student-life">
            <StudentLifeSection onOpenAdmissions={() => setIsAdmissionsOpen(true)} />
          </div>
        )}

        {landingSections?.gallery !== false && (
          <div id="gallery">
            <CampusGallery onOpenAdmissions={() => setIsAdmissionsOpen(true)} />
          </div>
        )}

        {landingSections?.faculty !== false && (
          <div id="faculty">
            <FacultyTeam />
          </div>
        )}

        {landingSections?.calendar !== false && (
          <div id="calendar">
            <AcademicCalendarSection />
          </div>
        )}

        {landingSections?.newsBlog !== false && (
          <div id="news-blog">
            <SchoolNewsBlogSection onOpenAdmissions={() => setIsAdmissionsOpen(true)} />
          </div>
        )}

        {landingSections?.notices !== false && (
          <div id="notices">
            <NoticeBoard onOpenAdmissions={() => setIsAdmissionsOpen(true)} />
          </div>
        )}

        {landingSections?.testimonials !== false && (
          <div id="testimonials">
            <Testimonials />
          </div>
        )}

        {landingSections?.achievements !== false && (
          <div id="achievements">
            <StudentAchievements />
          </div>
        )}

        {landingSections?.houseChampionship !== false && (
          <div id="house-championship">
            <HouseChampionshipLeaderboard />
          </div>
        )}

        {landingSections?.contributors !== false && (
          <div id="contributors">
            <ContributorsSection onOpenAdminCredits={() => setActiveSection('admin-portal')} />
          </div>
        )}

        {landingSections?.contact !== false && (
          <div id="contact">
            <ContactSection />
          </div>
        )}
      </main>

      {/* Accordion FAQ Section - Positioned in the Footer Area */}
      {landingSections?.faq !== false && (
        <FAQSection 
          onOpenAdmissions={() => setIsAdmissionsOpen(true)}
          onOpenTuitionCalc={() => setIsTuitionCalcOpen(true)}
        />
      )}

      {/* Universal Footer */}
      <Footer 
        onNavigate={handleNavigate}
        onOpenAdmissions={() => setIsAdmissionsOpen(true)}
        onOpenTuitionCalc={() => setIsTuitionCalcOpen(true)}
        onOpenStatusTracker={() => setIsTrackerOpen(true)}
        onOpenTour={() => setIsTourOpen(true)}
      />

      {/* Floating Utilities */}
      <WhatsAppButton />
      <FloatingChatWidget />

      {/* Floating Tour Launcher & First-time Welcome Prompt */}
      <div className="fixed bottom-6 left-6 z-40 flex flex-col items-start gap-2">
        {showTourPrompt && !isTourOpen && (
          <div className="bg-white/95 backdrop-blur-md text-slate-900 p-4 rounded-2xl shadow-2xl border border-amber-300 max-w-xs animate-fade-in flex flex-col gap-2 relative ring-1 ring-amber-400/40">
            <button
              onClick={() => setShowTourPrompt(false)}
              className="absolute top-2.5 right-2.5 p-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-2 pr-4">
              <Compass className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-xs font-bold text-slate-900">New to Stanbax Schools?</p>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              Take a 60-second guided tour of our curriculum, admissions, fees, and digital portals.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowTourPrompt(false);
                  setIsTourOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-amber-300 text-xs font-black shadow-xs flex items-center gap-1 cursor-pointer transition-all"
              >
                <span>Start Tour</span>
                <Compass className="w-3.5 h-3.5 text-amber-400" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowTourPrompt(false);
                  try {
                    localStorage.setItem('stanbax_tour_completed', 'true');
                  } catch {}
                }}
                className="text-[11px] text-slate-500 hover:text-slate-800 font-bold px-1.5 py-1"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsTourOpen(true)}
          className="bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs py-2.5 px-3.5 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2 border border-blue-800 hover:scale-105 active:scale-95 cursor-pointer group"
          id="floating-tour-guide-btn"
          title="Start interactive user walk-through"
        >
          <Compass className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
          <span className="hidden sm:inline">Guided Tour</span>
        </button>
      </div>

      {/* Modals with Suspense & Conditional Loading */}
      <React.Suspense fallback={null}>
        {isTourOpen && (
          <UserTourModal 
            isOpen={isTourOpen}
            onClose={() => setIsTourOpen(false)}
            onNavigate={handleNavigate}
            onOpenAdmissions={() => setIsAdmissionsOpen(true)}
            onOpenTuitionCalc={() => setIsTuitionCalcOpen(true)}
          />
        )}

        {isAdmissionsOpen && (
          <AdmissionsModal 
            isOpen={isAdmissionsOpen} 
            onClose={() => setIsAdmissionsOpen(false)} 
          />
        )}

        {isTuitionCalcOpen && (
          <TuitionCalculatorModal 
            isOpen={isTuitionCalcOpen}
            onClose={() => setIsTuitionCalcOpen(false)}
            onProceedToApply={() => {
              setIsTuitionCalcOpen(false);
              setIsAdmissionsOpen(true);
            }}
          />
        )}

        {isTrackerOpen && (
          <ApplicationTrackerModal 
            isOpen={isTrackerOpen}
            onClose={() => setIsTrackerOpen(false)}
          />
        )}

        {isCareerAdvisorOpen && (
          <CareerAdvisorModal 
            isOpen={isCareerAdvisorOpen}
            onClose={() => setIsCareerAdvisorOpen(false)}
          />
        )}
      </React.Suspense>
    </div>
  );
};

export default function App() {
  return (
    <SchoolProvider>
      <MainAppContent />
    </SchoolProvider>
  );
}
