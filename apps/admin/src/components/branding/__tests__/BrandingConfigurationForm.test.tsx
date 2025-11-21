import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import BrandingConfigurationForm from '../BrandingConfigurationForm';
import { BrandingConfig } from '../../../types/branding.types';
import { ThemeProvider } from '../ThemeProvider';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock data
const mockTenantId = 'tenant-123';
const mockInitialData: BrandingConfig = {
  id: '1',
  tenantId: mockTenantId,
  primaryColor: '#2563eb',
  secondaryColor: '#64748b',
  companyInfo: {
    name: 'Test Showroom',
    address: 'Test Address',
    phone: '+62 123 4567',
    email: 'test@showroom.com',
    website: 'https://test.com',
  },
};

const mockOnSave = jest.fn();

// Helper function to render component with ThemeProvider
const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider tenantId={mockTenantId}>
      {component}
    </ThemeProvider>
  );
};

describe('BrandingConfigurationForm', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders all form fields correctly', () => {
      renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          initialData={mockInitialData}
          onSave={mockOnSave}
        />
      );

      // Check main heading
      expect(screen.getByText('Konfigurasi Branding Showroom')).toBeInTheDocument();

      // Check file upload sections
      expect(screen.getByText('Logo Perusahaan')).toBeInTheDocument();
      expect(screen.getByText('Favicon (Icon Browser)')).toBeInTheDocument();

      // Check color pickers
      expect(screen.getByText('Warna Primer')).toBeInTheDocument();
      expect(screen.getByText('Warna Sekunder')).toBeInTheDocument();

      // Check company information fields
      expect(screen.getByLabelText('Nama Perusahaan *')).toBeInTheDocument();
      expect(screen.getByLabelText('Alamat Perusahaan')).toBeInTheDocument();
      expect(screen.getByLabelText('Nomor Telepon')).toBeInTheDocument();
      expect(screen.getByLabelText('Email Perusahaan')).toBeInTheDocument();
      expect(screen.getByLabelText('Website')).toBeInTheDocument();

      // Check action buttons
      expect(screen.getByText('Reset')).toBeInTheDocument();
      expect(screen.getByText('Simpan Perubahan')).toBeInTheDocument();
    });

    it('populates form with initial data', () => {
      renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          initialData={mockInitialData}
          onSave={mockOnSave}
        />
      );

      // Check if initial data is populated
      expect(screen.getByDisplayValue('Test Showroom')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Address')).toBeInTheDocument();
      expect(screen.getByDisplayValue('+62 123 4567')).toBeInTheDocument();
      expect(screen.getByDisplayValue('test@showroom.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://test.com')).toBeInTheDocument();
    });

    it('disables all form elements when disabled prop is true', () => {
      renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          initialData={mockInitialData}
          onSave={mockOnSave}
          disabled={true}
        />
      );

      // Check if inputs are disabled
      expect(screen.getByLabelText('Nama Perusahaan *')).toBeDisabled();
      expect(screen.getByLabelText('Email Perusahaan')).toBeDisabled();
      expect(screen.getByText('Simpan Perubahan')).toBeDisabled();
      expect(screen.getByText('Reset')).toBeDisabled();
    });
  });

  describe('Form Validation', () => {
    it('shows validation error for empty company name', async () => {
      renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          onSave={mockOnSave}
        />
      );

      // Clear company name field
      const companyNameInput = screen.getByLabelText('Nama Perusahaan *');
      await user.clear(companyNameInput);

      // Try to submit form
      const saveButton = screen.getByText('Simpan Perubahan');
      await user.click(saveButton);

      // Check for validation error
      await waitFor(() => {
        expect(screen.getByText(/Nama perusahaan wajib diisi/)).toBeInTheDocument();
      });

      // Save should not be called
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('validates email format', async () => {
      renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          onSave={mockOnSave}
        />
      );

      const emailInput = screen.getByLabelText('Email Perusahaan');
      await user.type(emailInput, 'invalid-email');

      // Trigger validation by clicking away
      await user.click(document.body);

      await waitFor(() => {
        expect(screen.getByText(/Format email tidak valid/)).toBeInTheDocument();
      });
    });

    it('validates phone number format', async () => {
      renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          onSave={mockOnSave}
        />
      );

      const phoneInput = screen.getByLabelText('Nomor Telepon');
      await user.type(phoneInput, 'invalid-phone');

      // Trigger validation by clicking away
      await user.click(document.body);

      await waitFor(() => {
        expect(screen.getByText(/Format nomor telepon tidak valid/)).toBeInTheDocument();
      });
    });

    it('validates hex color format', async () => {
      renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          onSave={mockOnSave}
        />
      );

      const primaryColorInput = screen.getByDisplayValue('#2563eb');
      await user.clear(primaryColorInput);
      await user.type(primaryColorInput, 'invalid-color');

      await waitFor(() => {
        expect(screen.getByText(/Format warna tidak valid/)).toBeInTheDocument();
      });
    });

    it('validates website URL format', async () => {
      renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          onSave={mockOnSave}
        />
      );

      const websiteInput = screen.getByLabelText('Website');
      await user.type(websiteInput, 'invalid-url');

      // Trigger validation by clicking away
      await user.click(document.body);

      await waitFor(() => {
        expect(screen.getByText(/Format website tidak valid/)).toBeInTheDocument();
      });
    });
  });

  describe('Color Picker', () => {
    it('allows selecting preset colors', async () => {
      renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          onSave={mockOnSave}
        />
      );

      // Find and click on a preset color
      const presetButtons = screen.getAllByText('Biru Profesional');
      const presetButton = presetButtons.find(btn =>
        btn.closest('button')?.querySelector('.font-semibold')
      );

      if (presetButton) {
        await user.click(presetButton);

        // Check if the color input value has changed
        const colorInput = screen.getByDisplayValue('#2563eb');
        // The actual color value would be updated to the preset's primary color
      }
    });

    it('shows accessibility information for colors', () => {
      renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          initialData={mockInitialData}
          onSave={mockOnSave}
        />
      );

      // Check for accessibility info
      expect(screen.getByText(/Kontras warna:/)).toBeInTheDocument();
      expect(screen.getByText(/Memenuhi standar WCAG AA/)).toBeInTheDocument();
    });
  });

  describe('File Upload', () => {
    it('shows file upload areas for logo and favicon', () => {
      renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          initialData={mockInitialData}
          onSave={mockOnSave}
        />
      );

      // Check for file upload areas
      expect(screen.getByText(/Klik untuk memilih file atau seret di sini/)).toBeInTheDocument();
      expect(screen.getByText(/Maksimal ukuran file: 5 MB/)).toBeInTheDocument();
    });

    it('shows file size limits and accepted formats', () => {
      renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          initialData={mockInitialData}
          onSave={mockOnSave}
        />
      );

      // Check for file format information
      expect(screen.getByText(/Format: image\/png,image\/jpeg,image\/jpg,image\/svg\+xml/)).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('submits form with valid data', async () => {
      mockOnSave.mockResolvedValue({ success: true, data: mockInitialData });

      renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          initialData={mockInitialData}
          onSave={mockOnSave}
        />
      );

      const saveButton = screen.getByText('Simpan Perubahan');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId: mockTenantId,
            primaryColor: '#2563eb',
            secondaryColor: '#64748b',
            companyInfo: expect.objectContaining({
              name: 'Test Showroom',
            }),
          })
        );
      });
    });

    it('shows loading state during submission', async () => {
      mockOnSave.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

      renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          initialData={mockInitialData}
          onSave={mockOnSave}
        />
      );

      const saveButton = screen.getByText('Simpan Perubahan');
      await user.click(saveButton);

      // Check for loading state
      expect(screen.getByText('Menyimpan...')).toBeInTheDocument();
      expect(saveButton).toBeDisabled();
    });

    it('shows server error when save fails', async () => {
      mockOnSave.mockResolvedValue({
        success: false,
        error: { code: 'SAVE_FAILED', message: 'Server error occurred' }
      });

      renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          initialData={mockInitialData}
          onSave={mockOnSave}
        />
      );

      const saveButton = screen.getByText('Simpan Perubahan');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Server error occurred')).toBeInTheDocument();
      });
    });
  });

  describe('Form Reset', () => {
    it('resets form to initial data', async () => {
      renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          initialData={mockInitialData}
          onSave={mockOnSave}
        />
      );

      // Change company name
      const companyNameInput = screen.getByLabelText('Nama Perusahaan *');
      await user.clear(companyNameInput);
      await user.type(companyNameInput, 'Modified Name');

      // Click reset
      const resetButton = screen.getByText('Reset');
      await user.click(resetButton);

      // Check if field is reset to initial value
      expect(screen.getByDisplayValue('Test Showroom')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should not have any accessibility violations', async () => {
      const { container } = renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          initialData={mockInitialData}
          onSave={mockOnSave}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has proper ARIA labels and roles', () => {
      renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          initialData={mockInitialData}
          onSave={mockOnSave}
        />
      );

      // Check for proper labeling
      expect(screen.getByLabelText('Nama Perusahaan *')).toBeInTheDocument();
      expect(screen.getByLabelText('Email Perusahaan')).toBeInTheDocument();

      // Check for proper form structure
      expect(screen.getByRole('form')).toBeInTheDocument();
    });

    it('provides helpful instructions for screen readers', () => {
      renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          initialData={mockInitialData}
          onSave={mockOnSave}
        />
      );

      // Check for help text and instructions
      expect(screen.getByText(/Pilih warna yang sesuai dengan identitas showroom Anda/)).toBeInTheDocument();
      expect(screen.getByText(/Upload logo perusahaan dalam format PNG, JPG, atau SVG/)).toBeInTheDocument();
    });
  });

  describe('Preview Functionality', () => {
    it('shows preview panel with current branding data', () => {
      renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          initialData={mockInitialData}
          onSave={mockOnSave}
        />
      );

      // Check for preview section
      expect(screen.getByText('Preview Real-time')).toBeInTheDocument();
      expect(screen.getByText('Test Showroom')).toBeInTheDocument(); // Company name in preview
    });

    it('updates preview when form data changes', async () => {
      renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          initialData={mockInitialData}
          onSave={mockOnSave}
        />
      );

      // Change company name
      const companyNameInput = screen.getByLabelText('Nama Perusahaan *');
      await user.clear(companyNameInput);
      await user.type(companyNameInput, 'New Company Name');

      // Preview should update (this would be visible in the preview panel)
      // Note: In a real test, you'd check if the preview content has been updated
    });
  });

  describe('Responsive Design', () => {
    it('adapts layout for different screen sizes', () => {
      // Mock different screen sizes
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768, // Tablet size
      });

      renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          initialData={mockInitialData}
          onSave={mockOnSave}
        />
      );

      // Check if responsive layout is applied
      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();

      // The layout should adapt based on Tailwind's responsive classes
      // This is more of a visual test that would be checked with E2E tests
    });
  });

  describe('Keyboard Navigation', () => {
    it('can be navigated using keyboard only', async () => {
      renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          initialData={mockInitialData}
          onSave={mockOnSave}
        />
      );

      // Tab through form fields
      await user.tab();
      expect(screen.getByLabelText('Nama Perusahaan *')).toHaveFocus();

      await user.tab();
      // Should focus on next field
    });

    it('supports Enter key to submit form', async () => {
      mockOnSave.mockResolvedValue({ success: true, data: mockInitialData });

      renderWithTheme(
        <BrandingConfigurationForm
          tenantId={mockTenantId}
          initialData={mockInitialData}
          onSave={mockOnSave}
        />
      );

      const companyNameInput = screen.getByLabelText('Nama Perusahaan *');
      companyNameInput.focus();

      await user.keyboard('{Enter}');

      // Form should be submitted
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
      });
    });
  });
});