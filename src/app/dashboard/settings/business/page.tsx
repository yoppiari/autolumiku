/**
 * Business Information Settings Page
 * Admin interface for managing showroom business info
 * Access: ADMIN+ only (Super Admin, Owner, Admin)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ROLE_LEVELS } from '@/lib/rbac';

interface BusinessInfo {
  phoneNumber: string;
  phoneNumberSecondary: string;
  whatsappNumber: string;
  email: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  googleMapsUrl: string;
  latitude: string;
  longitude: string;
  businessHours: {
    monday: { open: string; close: string; closed: boolean };
    tuesday: { open: string; close: string; closed: boolean };
    wednesday: { open: string; close: string; closed: boolean };
    thursday: { open: string; close: string; closed: boolean };
    friday: { open: string; close: string; closed: boolean };
    saturday: { open: string; close: string; closed: boolean };
    sunday: { open: string; close: string; closed: boolean };
  };
  socialMedia: {
    instagram: string;
    facebook: string;
    tiktok: string;
  };
}

const defaultBusinessHours = {
  monday: { open: '08:00', close: '17:00', closed: false },
  tuesday: { open: '08:00', close: '17:00', closed: false },
  wednesday: { open: '08:00', close: '17:00', closed: false },
  thursday: { open: '08:00', close: '17:00', closed: false },
  friday: { open: '08:00', close: '17:00', closed: false },
  saturday: { open: '08:00', close: '14:00', closed: false },
  sunday: { open: '08:00', close: '14:00', closed: true },
};

export default function BusinessInfoPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [formData, setFormData] = useState<BusinessInfo>({
    phoneNumber: '',
    phoneNumberSecondary: '',
    whatsappNumber: '',
    email: '',
    address: '',
    city: '',
    province: '',
    postalCode: '',
    googleMapsUrl: '',
    latitude: '',
    longitude: '',
    businessHours: defaultBusinessHours,
    socialMedia: {
      instagram: '',
      facebook: '',
      tiktok: '',
    },
  });

  // Access guard: ADMIN+ only (Super Admin, Owner, Admin)
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      const roleLevel = parsedUser.roleLevel || ROLE_LEVELS.SALES;

      // Only ADMIN (90), OWNER (100), SUPER_ADMIN (110) can access
      if (roleLevel < ROLE_LEVELS.ADMIN) {
        setAccessDenied(true);
        router.push('/dashboard');
        return;
      }

      setUser(parsedUser);
      loadBusinessInfo(parsedUser.tenantId);
    }
  }, [router]);

  const loadBusinessInfo = async (tenantId: string) => {
    try {
      const response = await fetch(`/api/v1/tenants/${tenantId}/business-info`);
      if (response.ok) {
        const data = await response.json();
        const info = data.data;

        setFormData({
          phoneNumber: info.phoneNumber || '',
          phoneNumberSecondary: info.phoneNumberSecondary || '',
          whatsappNumber: info.whatsappNumber || '',
          email: info.email || '',
          address: info.address || '',
          city: info.city || '',
          province: info.province || '',
          postalCode: info.postalCode || '',
          googleMapsUrl: info.googleMapsUrl || '',
          latitude: info.latitude?.toString() || '',
          longitude: info.longitude?.toString() || '',
          businessHours: info.businessHours || defaultBusinessHours,
          socialMedia: info.socialMedia || { instagram: '', facebook: '', tiktok: '' },
        });
      }
    } catch (error) {
      console.error('Failed to load business info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/v1/tenants/${user.tenantId}/business-info`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Business information updated successfully!' });
      } else {
        throw new Error('Failed to update');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update business information. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // Show nothing if access denied
  if (accessDenied) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/dashboard/settings" className="text-blue-600 hover:text-blue-800">
            ← Back to Settings
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-white">Business Information</h1>
        <p className="text-gray-400">Manage your showroom contact details and location</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-md ${message.type === 'success' ? 'bg-green-900/30 text-green-300 border border-green-800' : 'bg-red-900/30 text-red-300 border border-red-800'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Contact Information */}
        <div className="bg-[#2a2a2a] rounded-lg shadow p-6 border border-[#3a3a3a]">
          <h2 className="text-lg font-semibold mb-4 text-white">Contact Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Phone Number (Primary)
              </label>
              <input
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="+62-21-1234-5678"
                className="w-full px-4 py-2 bg-[#333] border border-[#444] text-white rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Phone Number (Secondary)
              </label>
              <input
                type="tel"
                value={formData.phoneNumberSecondary}
                onChange={(e) => setFormData({ ...formData, phoneNumberSecondary: e.target.value })}
                placeholder="+62-812-3456-7890"
                className="w-full px-4 py-2 bg-[#333] border border-[#444] text-white rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                WhatsApp Number
              </label>
              <input
                type="tel"
                value={formData.whatsappNumber}
                onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                placeholder="+62-812-3456-7890"
                className="w-full px-4 py-2 bg-[#333] border border-[#444] text-white rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="showroom@example.com"
                className="w-full px-4 py-2 bg-[#333] border border-[#444] text-white rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-[#2a2a2a] rounded-lg shadow p-6 border border-[#3a3a3a]">
          <h2 className="text-lg font-semibold mb-4 text-white">Address</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Street Address
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
                placeholder="Jl. Sudirman No. 123"
                className="w-full px-4 py-2 bg-[#333] border border-[#444] text-white rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Jakarta"
                  className="w-full px-4 py-2 bg-[#333] border border-[#444] text-white rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Province</label>
                <input
                  type="text"
                  value={formData.province}
                  onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                  placeholder="DKI Jakarta"
                  className="w-full px-4 py-2 bg-[#333] border border-[#444] text-white rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Postal Code</label>
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  placeholder="12345"
                  className="w-full px-4 py-2 bg-[#333] border border-[#444] text-white rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Google Maps */}
        <div className="bg-[#2a2a2a] rounded-lg shadow p-6 border border-[#3a3a3a]">
          <h2 className="text-lg font-semibold mb-4 text-white">Location (Google Maps)</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Google Maps URL
              </label>
              <input
                type="url"
                value={formData.googleMapsUrl}
                onChange={(e) => setFormData({ ...formData, googleMapsUrl: e.target.value })}
                placeholder="https://maps.google.com/..."
                className="w-full px-4 py-2 bg-[#333] border border-[#444] text-white rounded-md focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Share link from Google Maps
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Latitude</label>
                <input
                  type="text"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  placeholder="-6.2088"
                  className="w-full px-4 py-2 bg-[#333] border border-[#444] text-white rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Longitude</label>
                <input
                  type="text"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  placeholder="106.8456"
                  className="w-full px-4 py-2 bg-[#333] border border-[#444] text-white rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Social Media */}
        <div className="bg-[#2a2a2a] rounded-lg shadow p-6 border border-[#3a3a3a]">
          <h2 className="text-lg font-semibold mb-4 text-white">Social Media</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Instagram URL</label>
              <input
                type="url"
                value={formData.socialMedia.instagram}
                onChange={(e) => setFormData({
                  ...formData,
                  socialMedia: { ...formData.socialMedia, instagram: e.target.value }
                })}
                placeholder="https://instagram.com/showroom"
                className="w-full px-4 py-2 bg-[#333] border border-[#444] text-white rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Facebook URL</label>
              <input
                type="url"
                value={formData.socialMedia.facebook}
                onChange={(e) => setFormData({
                  ...formData,
                  socialMedia: { ...formData.socialMedia, facebook: e.target.value }
                })}
                placeholder="https://facebook.com/showroom"
                className="w-full px-4 py-2 bg-[#333] border border-[#444] text-white rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">TikTok URL</label>
              <input
                type="url"
                value={formData.socialMedia.tiktok}
                onChange={(e) => setFormData({
                  ...formData,
                  socialMedia: { ...formData.socialMedia, tiktok: e.target.value }
                })}
                placeholder="https://tiktok.com/@showroom"
                className="w-full px-4 py-2 bg-[#333] border border-[#444] text-white rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Link
            href="/dashboard/settings"
            className="px-6 py-2 border border-[#444] rounded-md text-gray-300 hover:bg-[#333]"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
