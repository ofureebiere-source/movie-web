'use client';

import { useState } from 'react';
import { SUPPORT_EMAIL } from 'constants/brand';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import LoadingSpinerBtn from '../loading/loading-spiner-btn';
import {
  IoHelpCircle,
  IoMail,
  IoChatbubble,
  IoDocumentText,
  IoCheckmark,
  IoClose,
  IoCall,
  IoTime,
} from 'react-icons/io5';

interface SupportFormData {
  name: string;
  email: string;
  subject: string;
  category: string;
  message: string;
}

const supportCategories = [
  { value: 'technical', label: 'Vấn đề kỹ thuật' },
  { value: 'account', label: 'Tài khoản' },
  { value: 'billing', label: 'Thanh toán' },
  { value: 'feature', label: 'Tính năng' },
  { value: 'bug', label: 'Báo lỗi' },
  { value: 'other', label: 'Khác' },
];

const contactMethods = [
  {
    icon: IoMail,
    title: 'Email hỗ trợ',
    description: 'Gửi email cho chúng tôi',
    contact: SUPPORT_EMAIL,
    action: 'Gửi email',
    color: 'text-blue-400',
  },
  {
    icon: IoChatbubble,
    title: 'Chat trực tuyến',
    description: 'Trò chuyện với nhân viên hỗ trợ',
    contact: 'Có sẵn 24/7',
    action: 'Bắt đầu chat',
    color: 'text-green-400',
  },
  {
    icon: IoCall,
    title: 'Điện thoại',
    description: 'Gọi điện trực tiếp',
    contact: '+84 123 456 789',
    action: 'Gọi ngay',
    color: 'text-purple-400',
  },
];

export default function SupportContact() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<SupportFormData>();

  const onSubmit = async (data: SupportFormData) => {
    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast.success(
        'Tin nhắn của bạn đã được gửi thành công! Chúng tôi sẽ phản hồi trong vòng 24 giờ.'
      );
      reset();
      setShowForm(false);
    } catch (error) {
      toast.error('Có lỗi xảy ra khi gửi tin nhắn. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center space-x-3 mb-6">
        <IoHelpCircle className="text-custome-red" size={24} />
        <h2 className="text-xl font-semibold text-content-main">Hỗ trợ</h2>
      </div>

      <div className="mb-6">
        <p className="text-content-muted">
          Chúng tôi luôn sẵn sàng hỗ trợ bạn. Chọn phương thức liên hệ phù hợp nhất với bạn.
        </p>
      </div>

      {/* Contact Methods */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {contactMethods.map((method, index) => {
          const Icon = method.icon;
          return (
            <div
              key={index}
              className="bg-surface-chip border border-line rounded-lg p-6 hover:border-line transition-colors"
            >
              <div className="flex items-center space-x-3 mb-4">
                <Icon className={method.color} size={24} />
                <h3 className="text-content-main font-medium">{method.title}</h3>
              </div>
              <p className="text-content-muted text-sm mb-3">{method.description}</p>
              <p className="text-content-soft text-sm mb-4">{method.contact}</p>
              <button
                onClick={() => {
                  if (method.title === 'Email hỗ trợ') {
                    setShowForm(true);
                  } else {
                    toast.info('Tính năng này sẽ sớm được triển khai');
                  }
                }}
                className="glass-btn glass-btn-sm glass-btn-primary glass-btn-block"
              >
                {method.action}
              </button>
            </div>
          );
        })}
      </div>

      {/* Support Form */}
      {showForm && (
        <div className="border-t border-line pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-content-main font-medium">Gửi tin nhắn hỗ trợ</h3>
            <button onClick={() => setShowForm(false)} className="text-content-muted hover:text-content-main">
              <IoClose size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-content-soft mb-2">
                  Họ và tên
                </label>
                <input
                  type="text"
                  id="name"
                  className={`w-full p-3 border ${
                    errors.name ? 'border-red-500' : 'border-line'
                  } bg-surface-primary text-content-main focus:outline-none focus:ring-2 ${
                    errors.name ? 'focus:ring-red-500' : 'focus:ring-custome-red'
                  } rounded-lg`}
                  {...register('name', {
                    required: 'Họ và tên là bắt buộc',
                  })}
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label htmlFor="email" className="block text-content-soft mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  className={`w-full p-3 border ${
                    errors.email ? 'border-red-500' : 'border-line'
                  } bg-surface-primary text-content-main focus:outline-none focus:ring-2 ${
                    errors.email ? 'focus:ring-red-500' : 'focus:ring-custome-red'
                  } rounded-lg`}
                  {...register('email', {
                    required: 'Email là bắt buộc',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Email không hợp lệ',
                    },
                  })}
                />
                {errors.email && (
                  <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="category" className="block text-content-soft mb-2">
                Loại vấn đề
              </label>
              <select
                id="category"
                className={`w-full p-3 border ${
                  errors.category ? 'border-red-500' : 'border-line'
                } bg-surface-primary text-content-main focus:outline-none focus:ring-2 ${
                  errors.category ? 'focus:ring-red-500' : 'focus:ring-custome-red'
                } rounded-lg`}
                {...register('category', {
                  required: 'Vui lòng chọn loại vấn đề',
                })}
              >
                <option value="">Chọn loại vấn đề</option>
                {supportCategories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="text-red-500 text-sm mt-1">{errors.category.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="subject" className="block text-content-soft mb-2">
                Tiêu đề
              </label>
              <input
                type="text"
                id="subject"
                className={`w-full p-3 border ${
                  errors.subject ? 'border-red-500' : 'border-line'
                } bg-surface-primary text-content-main focus:outline-none focus:ring-2 ${
                  errors.subject ? 'focus:ring-red-500' : 'focus:ring-custome-red'
                } rounded-lg`}
                {...register('subject', {
                  required: 'Tiêu đề là bắt buộc',
                })}
              />
              {errors.subject && (
                <p className="text-red-500 text-sm mt-1">{errors.subject.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="message" className="block text-content-soft mb-2">
                Nội dung
              </label>
              <textarea
                id="message"
                rows={5}
                className={`w-full p-3 border ${
                  errors.message ? 'border-red-500' : 'border-line'
                } bg-surface-primary text-content-main focus:outline-none focus:ring-2 ${
                  errors.message ? 'focus:ring-red-500' : 'focus:ring-custome-red'
                } rounded-lg resize-none`}
                {...register('message', {
                  required: 'Nội dung là bắt buộc',
                  minLength: {
                    value: 10,
                    message: 'Nội dung phải có ít nhất 10 ký tự',
                  },
                })}
                placeholder="Mô tả chi tiết vấn đề của bạn..."
              />
              {errors.message && (
                <p className="text-red-500 text-sm mt-1">{errors.message.message}</p>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="glass-btn glass-btn-primary"
              >
                {isSubmitting ? (
                  <LoadingSpinerBtn />
                ) : (
                  <>
                    <IoCheckmark size={16} />
                    <span>Gửi tin nhắn</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="glass-btn"
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FAQ Section */}
      <div className="border-t border-line pt-6 mt-8">
        <h3 className="text-content-main font-medium mb-4">Câu hỏi thường gặp</h3>
        <div className="space-y-4">
          <div className="bg-surface-chip border border-line rounded-lg p-4">
            <h4 className="text-content-main font-medium mb-2">Làm thế nào để đổi mật khẩu?</h4>
            <p className="text-content-muted text-sm">
              Vào phần &quot;Bảo mật&quot; trong menu bên trái và chọn &quot;Đổi mật khẩu&quot;. Bạn
              cần nhập mật khẩu hiện tại và mật khẩu mới.
            </p>
          </div>

          <div className="bg-surface-chip border border-line rounded-lg p-4">
            <h4 className="text-content-main font-medium mb-2">Tôi quên mật khẩu, phải làm sao?</h4>
            <p className="text-content-muted text-sm">
              Sử dụng tính năng `&quot;Quên mật khẩu&quot;` trên trang đăng nhập. Chúng tôi sẽ gửi
              link đặt lại mật khẩu qua email của bạn.
            </p>
          </div>

          <div className="bg-surface-chip border border-line rounded-lg p-4">
            <h4 className="text-content-main font-medium mb-2">Làm sao để xóa tài khoản?</h4>
            <p className="text-content-muted text-sm">
              Liên hệ với chúng tôi qua email {SUPPORT_EMAIL} để được hỗ trợ xóa tài khoản.
            </p>
          </div>
        </div>
      </div>

      {/* Support Hours */}
      <div className="mt-8 p-4 bg-surface-chip border border-line rounded-lg">
        <div className="flex items-center space-x-3 mb-2">
          <IoTime className="text-custome-red" size={20} />
          <h4 className="text-content-main font-medium">Giờ hỗ trợ</h4>
        </div>
        <p className="text-content-muted text-sm">
          Thứ 2 - Thứ 6: 8:00 - 18:00 (GMT+7)
          <br />
          Thứ 7 - Chủ nhật: 9:00 - 17:00 (GMT+7)
        </p>
      </div>
    </div>
  );
}
