'use client';

import { ProfileSection } from './index';
import { IoPerson, IoFingerPrint, IoLanguage, IoHelpCircle, IoTrash } from 'react-icons/io5';
import { useDispatch } from 'react-redux';
import { removeUser } from '../../redux/slices/user-slice';
import { useState } from 'react';
import { forgetDevice } from '../../lib/device';
interface ProfileSidebarProps {
  activeSection: ProfileSection;
  onSectionChange: (section: ProfileSection) => void;
  user: any;
}

const menuItems = [
  {
    id: 'personal' as ProfileSection,
    label: 'Thông tin cá nhân',
    icon: IoPerson,
  },
  {
    id: 'security' as ProfileSection,
    label: 'Thiết bị',
    icon: IoFingerPrint,
  },
  {
    id: 'language' as ProfileSection,
    label: 'Ngôn ngữ',
    icon: IoLanguage,
  },
  {
    id: 'support' as ProfileSection,
    label: 'Hỗ trợ',
    icon: IoHelpCircle,
  },
];

export default function ProfileSidebar({
  activeSection,
  onSectionChange,
  user,
}: ProfileSidebarProps) {
  const dispatch = useDispatch();
  const [isConfirmingForget, setIsConfirmingForget] = useState(false);

  const handleForgetDevice = () => {
    if (!isConfirmingForget) {
      setIsConfirmingForget(true);
      return;
    }
    forgetDevice();
    dispatch(removeUser());
    window.location.href = '/';
  };

  return (
    <div className="bg-black/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4 lg:p-6">
      {/* User Info */}
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            {user.photo ? (
              <img src={user.photo} alt="Avatar" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <span className="text-white font-semibold text-lg">
                {user.name?.charAt(0)?.toUpperCase() || 'D'}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate" data-private>{user.name || 'Thiết bị'}</p>
            <p className="text-gray-400 text-xs truncate font-mono" data-private>{(user.device?.id ?? user.id ?? '').slice(0, 12)}</p>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <nav className="space-y-2 mb-6">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-left transition-colors ${
                isActive
                  ? 'bg-custome-red text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <Icon size={18} />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Forget device */}
      <div className="border-t border-gray-700 pt-4">
        <button
          onClick={handleForgetDevice}
          className="w-full flex items-center space-x-3 px-3 py-3 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
        >
          <IoTrash size={18} />
          <span className="text-sm font-medium">
            {isConfirmingForget ? 'Nhấn lần nữa để xóa' : 'Quên thiết bị này'}
          </span>
        </button>
      </div>
    </div>
  );
}
