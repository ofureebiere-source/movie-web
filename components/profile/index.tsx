'use client';

import { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import PersonalInfo from './personal-info';
import NotificationSettings from './notification-settings';
import SupportContact from './support-contact';
import { useTranslations } from 'next-intl';

export type ProfileSection = 'personal' | 'notifications' | 'support';

export default function Profile() {
  const t = useTranslations('profile');
  const user = useSelector((state: RootState) => state.auth.user) as any;
  const [activeSection, setActiveSection] = useState<ProfileSection>('personal');

  if (!user) {
    return (
      <div className="pt-20 lg:pt-32 container-wrapper-movie h-full px-4 lg:px-0">
        <div className="flex justify-center items-center py-20">
          <div className="text-center">
            <h2 className="text-content-main text-xl font-semibold mb-4">{t('loginRequired.title')}</h2>
            <p className="text-content-muted">{t('loginRequired.message')}</p>
          </div>
        </div>
      </div>
    );
  }

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'personal':
        return <PersonalInfo user={user} />;
      case 'notifications':
        return <NotificationSettings />;
      case 'support':
        return <SupportContact />;
      default:
        return <PersonalInfo user={user} />;
    }
  };

  return (
    <div className="pt-20 lg:pt-32 container-wrapper-movie h-full px-4 lg:px-0">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-content-main mb-2">{t('page.title')}</h1>
          <p className="text-content-muted">{t('page.subtitle')}</p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-surface-primary/50 backdrop-blur-sm border border-line rounded-xl p-4 lg:p-6">
              {/* Menu Items — horizontal scroll strip on mobile, vertical sidebar on lg */}
              <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:space-y-2 lg:overflow-visible lg:px-0 lg:pb-0">
                {[
                  { id: 'personal', label: t('menu.personalInfo') },
                  { id: 'notifications', label: t('menu.notifications') },
                  { id: 'support', label: t('menu.support') },
                ].map((item) => {
                  const isActive = activeSection === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id as ProfileSection)}
                      className={`glass-btn glass-btn-sm min-h-[44px] flex-shrink-0 rounded-lg lg:w-full lg:justify-start ${
                        isActive ? 'glass-btn-primary' : 'text-content-soft hover:text-content-main'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3">
            <div className="bg-surface-primary/50 backdrop-blur-sm border border-line rounded-xl p-6 lg:p-8">
              {renderActiveSection()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
