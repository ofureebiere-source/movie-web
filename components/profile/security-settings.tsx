'use client';

import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { removeUser } from '../../redux/slices/user-slice';
import { forgetDevice } from '../../lib/device';
import { useDeviceAuth } from '../context/auth-conext';
import { IoShieldCheckmark, IoFingerPrint, IoTrash, IoCheckmark, IoClose } from 'react-icons/io5';

/**
 * "This device" — what replaced the account-security screen.
 *
 * There is no password to change and no second factor to enable, because
 * there is no account: the app identifies the browser. What is genuinely
 * useful here is showing WHICH identity is in use, letting the viewer rename
 * it, and offering the one destructive action that exists — forgetting the
 * device, which discards the id and with it the collection, comments and
 * watch history.
 */

interface DeviceSettingsProps {
  user: any;
}

export default function SecuritySettings({ user }: DeviceSettingsProps) {
  const dispatch = useDispatch();
  const { rename } = useDeviceAuth();
  const [isRenaming, setIsRenaming] = useState(false);
  const [isConfirmingForget, setIsConfirmingForget] = useState(false);
  const [draftName, setDraftName] = useState('');

  useEffect(() => {
    setDraftName(user?.name ?? '');
  }, [user?.name]);

  const deviceId: string = user?.device?.id ?? user?.id ?? '';
  const createdAt: number | undefined = user?.createdAt ?? user?.device?.createdAt;

  const handleSaveName = () => {
    if (!draftName.trim()) {
      toast.error('Tên thiết bị không được để trống');
      return;
    }
    rename(draftName);
    setIsRenaming(false);
    toast.success('Đã lưu tên thiết bị');
  };

  const handleForget = () => {
    forgetDevice();
    dispatch(removeUser());
    // Full reload: the device id is gone, so the app must re-register from a
    // clean slate rather than keep rendering the old account from memory.
    window.location.href = '/';
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Thiết bị này</h2>
        {!isRenaming && (
          <button
            onClick={() => setIsRenaming(true)}
            className="self-start px-4 py-2 bg-custome-red text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Đổi tên thiết bị
          </button>
        )}
      </div>

      {/* Identity overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8">
        <div className="bg-gray-800/30 border border-gray-600 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-2">
            <IoFingerPrint className="text-green-400" size={20} />
            <h3 className="text-white font-medium">Mã thiết bị</h3>
          </div>
          <p className="text-gray-400 text-xs sm:text-sm break-all font-mono">{deviceId}</p>
        </div>

        <div className="bg-gray-800/30 border border-gray-600 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-2">
            <IoShieldCheckmark className="text-green-400" size={20} />
            <h3 className="text-white font-medium">Trạng thái</h3>
          </div>
          <p className="text-gray-400 text-xs sm:text-sm">
            Đã đăng ký tự động
            {createdAt ? ` • ${new Date(createdAt).toLocaleDateString()}` : ''}
          </p>
        </div>
      </div>

      {/* Rename */}
      {isRenaming && (
        <div className="border-t border-gray-700 pt-6">
          <h3 className="text-white font-medium mb-4">Đổi tên thiết bị</h3>
          <label htmlFor="deviceName" className="block text-gray-300 mb-2">
            Tên hiển thị
          </label>
          <input
            id="deviceName"
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            maxLength={40}
            className="w-full p-3 border border-gray-600 bg-black text-white focus:outline-none focus:ring-2 focus:ring-custome-red rounded-lg"
          />
          <div className="flex flex-wrap items-center gap-3 pt-4">
            <button
              type="button"
              onClick={handleSaveName}
              className="flex items-center space-x-2 px-6 py-3 bg-custome-red text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <IoCheckmark size={16} />
              <span>Lưu</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRenaming(false);
                setDraftName(user?.name ?? '');
              }}
              className="flex items-center space-x-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <IoClose size={16} />
              <span>Hủy</span>
            </button>
          </div>
        </div>
      )}

      {/* Forget device */}
      <div className="border-t border-gray-700 pt-6 mt-8">
        <h3 className="text-white font-medium mb-2">Quên thiết bị</h3>
        <p className="text-gray-400 text-sm mb-4">
          Xóa danh sách phim, bình luận và lịch sử xem của thiết bị này. Hành động này không thể
          hoàn tác.
        </p>

        {isConfirmingForget ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleForget}
              className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <IoTrash size={16} />
              <span>Xác nhận xóa</span>
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmingForget(false)}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Hủy
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsConfirmingForget(true)}
            className="flex items-center space-x-2 px-6 py-3 bg-transparent border border-red-600 text-red-400 rounded-lg hover:bg-red-600/10 transition-colors"
          >
            <IoTrash size={16} />
            <span>Quên thiết bị này</span>
          </button>
        )}
      </div>

      {/* How it works */}
      <div className="border-t border-gray-700 pt-6 mt-8">
        <h3 className="text-white font-medium mb-4">Cách hoạt động</h3>
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-custome-red rounded-full mt-2 shrink-0"></div>
            <p className="text-gray-400 text-sm">
              Không cần đăng nhập hay mật khẩu. Trình duyệt này tự động được cấp một mã thiết bị.
            </p>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-custome-red rounded-full mt-2 shrink-0"></div>
            <p className="text-gray-400 text-sm">
              Dữ liệu của bạn được lưu trên chính thiết bị này, không gửi lên máy chủ.
            </p>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-custome-red rounded-full mt-2 shrink-0"></div>
            <p className="text-gray-400 text-sm">
              Xóa dữ liệu trình duyệt sẽ tạo một thiết bị mới và bạn sẽ mất dữ liệu cũ.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
