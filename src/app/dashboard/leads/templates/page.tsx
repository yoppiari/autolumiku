/**
 * Message Templates Management Page
 * Epic 6: Track C - Message Templates
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { FaPlus, FaEdit, FaTrash, FaCopy } from 'react-icons/fa';

interface MessageTemplate {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  subject?: string;
  content: string;
  variables: string[];
  isActive: boolean;
  usageCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  { value: 'greeting', label: 'Greeting' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'closing', label: 'Closing' },
  { value: 'custom', label: 'Custom' },
];

const AVAILABLE_VARIABLES = [
  '{{customerName}}',
  '{{vehicleName}}',
  '{{price}}',
  '{{year}}',
  '{{make}}',
  '{{model}}',
  '{{showroomName}}',
  '{{phoneNumber}}',
];

export default function TemplatesPage() {
  const [user, setUser] = useState<any>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    category: 'custom',
    subject: '',
    content: '',
    isActive: true,
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      loadTemplates(parsedUser.tenantId);
    }
  }, []);

  const loadTemplates = async (tenantId: string) => {
    try {
      const response = await fetch(`/api/v1/message-templates?tenantId=${tenantId}`);
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.data);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
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
      const url = editingTemplate
        ? `/api/v1/message-templates/${editingTemplate.id}`
        : '/api/v1/message-templates';

      const method = editingTemplate ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: user.tenantId,
          ...formData,
          variables: extractVariables(formData.content),
          createdBy: user.id,
        }),
      });

      if (response.ok) {
        setMessage({
          type: 'success',
          text: editingTemplate ? 'Template updated!' : 'Template created!',
        });
        loadTemplates(user.tenantId);
        handleCloseModal();
      } else {
        throw new Error('Failed to save template');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save template. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!user || !confirm('Are you sure you want to delete this template?')) return;

    try {
      const response = await fetch(
        `/api/v1/message-templates/${templateId}?tenantId=${user.tenantId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        setMessage({ type: 'success', text: 'Template deleted!' });
        loadTemplates(user.tenantId);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete template.' });
    }
  };

  const handleEdit = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      category: template.category,
      subject: template.subject || '',
      content: template.content,
      isActive: template.isActive,
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
    setFormData({
      name: '',
      category: 'custom',
      subject: '',
      content: '',
      isActive: true,
    });
  };

  const extractVariables = (content: string): string[] => {
    const regex = /\{\{(\w+)\}\}/g;
    const matches = content.match(regex) || [];
    return Array.from(new Set(matches));
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('content-textarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData.content;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      setFormData({ ...formData, content: before + variable + after });
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

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
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/dashboard/leads" className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block">
            ← Back to Leads
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Message Templates</h1>
          <p className="text-gray-600">Manage reusable message templates for lead communication</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <FaPlus /> New Template
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <div key={template.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">{template.name}</h3>
                <p className="text-sm text-gray-500 capitalize">{template.category}</p>
              </div>
              <span
                className={`px-2 py-1 text-xs rounded-full ${
                  template.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}
              >
                {template.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-700 line-clamp-3">{template.content}</p>
            </div>

            {template.variables.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1">
                {template.variables.map((variable, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                    {variable}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
              <span>Used: {template.usageCount}x</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(template)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
              >
                <FaEdit /> Edit
              </button>
              <button
                onClick={() => handleDelete(template.id)}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm"
              >
                <FaTrash />
              </button>
            </div>
          </div>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No templates yet. Create your first template!</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create Template
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 text-2xl">
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject (Optional)</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea
                  id="content-textarea"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={6}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Use variables like {'{{customerName}}'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Insert Variables</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_VARIABLES.map((variable) => (
                    <button
                      key={variable}
                      type="button"
                      onClick={() => insertVariable(variable)}
                      className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-md hover:bg-blue-200"
                    >
                      {variable}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
              </div>

              <div className="flex gap-4 pt-4 border-t">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {saving ? 'Saving...' : editingTemplate ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
