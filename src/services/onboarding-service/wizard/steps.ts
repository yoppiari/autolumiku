import { OnboardingStep, StepDefinition, HelpContent, ValidationSchema } from '../../../types/onboarding';

/**
 * Onboarding Step Definitions
 *
 * Defines each step in the onboarding wizard including:
 * - Step metadata (title, description, required status)
 * - Validation schemas
 * - Help content
 * - Estimated completion time
 */

export const stepDefinitions: StepDefinition[] = [
  {
    id: OnboardingStep.WELCOME,
    title: {
      id: 'Selamat Datang di autolumiku',
      en: 'Welcome to autolumiku'
    },
    description: {
      id: 'Mari kita mulai perjalanan digital showroom Anda. Kami akan memandu Anda langkah demi langkah.',
      en: 'Let\'s start your digital showroom journey. We\'ll guide you step by step.'
    },
    required: true,
    estimatedTime: 2,
    helpContent: {
      title: {
        id: 'Bantuan Selamat Datang',
        en: 'Welcome Help'
      },
      sections: [
        {
          title: {
            id: 'Apa itu autolumiku?',
            en: 'What is autolumiku?'
          },
          content: {
            id: 'autolumiku adalah platform digital yang membantu showroom mobil untuk mengelola inventaris, membuat website, dan berinteraksi dengan pelanggan secara lebih efisien.',
            en: 'autolumiku is a digital platform that helps car showrooms manage inventory, create websites, and interact with customers more efficiently.'
          },
          type: 'text'
        },
        {
          title: {
            id: 'Berapa lama proses onboarding?',
            en: 'How long does onboarding take?'
          },
          content: {
            id: 'Proses onboarding biasanya memakan waktu 20-30 menit. Anda dapat menyimpan progress dan melanjutkan kapan saja.',
            en: 'The onboarding process typically takes 20-30 minutes. You can save your progress and continue anytime.'
          },
          type: 'text'
        }
      ],
      tips: [
        'Siapkan informasi dasar showroom Anda (nama, alamat, kontak)',
        'Siapkan logo showroom jika ada (opsional)',
        'Pastikan Anda memiliki koneksi internet yang stabil'
      ],
      relatedDocs: ['getting-started-guide', 'onboarding-tutorial']
    }
  },

  {
    id: OnboardingStep.BASIC_INFO,
    title: {
      id: 'Informasi Dasar Showroom',
      en: 'Basic Showroom Information'
    },
    description: {
      id: 'Mari kumpulkan informasi dasar tentang showroom Anda untuk memulai.',
      en: 'Let\'s collect basic information about your showroom to get started.'
    },
    required: true,
    estimatedTime: 8,
    validation: {
      fields: {
        showroomName: {
          required: true,
          type: 'string',
          minLength: 3,
          maxLength: 100,
          pattern: '^[a-zA-Z0-9\\s\\-\\.]+$'
        },
        showroomType: {
          required: true,
          type: 'string',
          options: ['new_car', 'used_car', 'both']
        },
        contactEmail: {
          required: true,
          type: 'email'
        },
        phoneNumber: {
          required: true,
          type: 'phone',
          pattern: '^[+]?[0-9]{10,15}$'
        },
        address: {
          required: true,
          type: 'string',
          minLength: 10,
          maxLength: 500
        },
        city: {
          required: true,
          type: 'string',
          minLength: 2,
          maxLength: 50
        },
        province: {
          required: true,
          type: 'string',
          minLength: 2,
          maxLength: 50
        },
        postalCode: {
          required: true,
          type: 'string',
          pattern: '^[0-9]{5}$'
        },
        website: {
          required: false,
          type: 'url'
        },
        businessLicense: {
          required: false,
          type: 'string'
        },
        taxId: {
          required: false,
          type: 'string'
        }
      }
    },
    helpContent: {
      title: {
        id: 'Bantuan Informasi Dasar',
        en: 'Basic Information Help'
      },
      sections: [
        {
          title: {
            id: 'Jenis Showroom',
            en: 'Showroom Type'
          },
          content: {
            id: 'Pilih jenis showroom yang sesuai: Mobil Baru (dealer resmi), Mobil Bekas, atau Keduanya.',
            en: 'Choose the appropriate showroom type: New Cars (official dealer), Used Cars, or Both.'
          },
          type: 'text'
        },
        {
          title: {
            id: 'Format Nomor Telepon',
            en: 'Phone Number Format'
          },
          content: {
            id: 'Gunakan format nomor telepon Indonesia: +628123456789 atau 08123456789',
            en: 'Use Indonesian phone format: +628123456789 or 08123456789'
          },
          type: 'text'
        }
      ],
      tips: [
        'Gunakan nama resmi showroom Anda',
        'Pastikan email dan nomor telepon aktif',
        'Tulis alamat lengkap dengan kode pos'
      ],
      relatedDocs: ['showroom-setup-guide', 'business-requirements']
    }
  },

  {
    id: OnboardingStep.BRANDING,
    title: {
      id: 'Konfigurasi Branding',
      en: 'Branding Configuration'
    },
    description: {
      id: 'Personalisasi tampilan showroom Anda dengan logo dan warna yang mencerminkan identitas bisnis Anda.',
      en: 'Personalize your showroom appearance with logo and colors that reflect your business identity.'
    },
    required: false,
    estimatedTime: 10,
    validation: {
      fields: {
        logo: {
          required: false,
          type: 'file',
          custom: (value: any) => {
            if (!value) return true; // Optional
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            const maxSize = 5 * 1024 * 1024; // 5MB
            return allowedTypes.includes(value.type) && value.size <= maxSize;
          }
        },
        primaryColor: {
          required: false,
          type: 'color',
          pattern: '^#[0-9A-Fa-f]{6}$'
        },
        secondaryColor: {
          required: false,
          type: 'color',
          pattern: '^#[0-9A-Fa-f]{6}$'
        },
        accentColor: {
          required: false,
          type: 'color',
          pattern: '^#[0-9A-Fa-f]{6}$'
        },
        theme: {
          required: false,
          type: 'string',
          options: ['modern', 'classic', 'minimal', 'corporate']
        },
        customCSS: {
          required: false,
          type: 'string',
          maxLength: 10000
        },
        favicon: {
          required: false,
          type: 'file',
          custom: (value: any) => {
            if (!value) return true; // Optional
            const allowedTypes = ['image/x-icon', 'image/png'];
            const maxSize = 100 * 1024; // 100KB
            return allowedTypes.includes(value.type) && value.size <= maxSize;
          }
        }
      }
    },
    helpContent: {
      title: {
        id: 'Bantuan Branding',
        en: 'Branding Help'
      },
      sections: [
        {
          title: {
            id: 'Memilih Warna Brand',
            en: 'Choosing Brand Colors'
          },
          content: {
            id: 'Pilih warna yang mencerminkan identitas bisnis Anda. Warna utama akan digunakan untuk elemen penting seperti tombol dan link.',
            en: 'Choose colors that reflect your business identity. The primary color will be used for important elements like buttons and links.'
          },
          type: 'text'
        },
        {
          title: {
            id: 'Upload Logo',
            en: 'Logo Upload'
          },
          content: {
            id: 'Upload logo showroom Anda dalam format PNG, JPG, atau GIF. Ukuran maksimal 5MB. Logo akan ditampilkan di website dan materi promosi.',
            en: 'Upload your showroom logo in PNG, JPG, or GIF format. Maximum size 5MB. The logo will be displayed on the website and promotional materials.'
          },
          type: 'text'
        }
      ],
      tips: [
        'Gunakan logo dengan resolusi tinggi untuk hasil terbaik',
        'Pilih warna yang kontras untuk keterbacaan yang baik',
        'Template tema dapat disesuaikan nanti jika diperlukan'
      ],
      relatedDocs: ['branding-guide', 'color-psychology']
    }
  },

  {
    id: OnboardingStep.TEAM,
    title: {
      id: 'Setup Tim',
      en: 'Team Setup'
    },
    description: {
      id: 'Undang anggota tim Anda dan atur peran serta hak akses mereka.',
      en: 'Invite your team members and set their roles and access permissions.'
    },
    required: false,
    estimatedTime: 7,
    validation: {
      fields: {
        invitations: {
          required: false,
          type: 'array',
          custom: (value: any[]) => {
            if (!value || value.length === 0) return true; // Optional
            return value.every(invitation => {
              return invitation.email &&
                     invitation.firstName &&
                     invitation.lastName &&
                     ['admin', 'manager', 'sales', 'viewer'].includes(invitation.role);
            });
          }
        }
      }
    },
    helpContent: {
      title: {
        id: 'Bantuan Setup Tim',
        en: 'Team Setup Help'
      },
      sections: [
        {
          title: {
            id: 'Peran dan Hak Akses',
            en: 'Roles and Permissions'
          },
          content: {
            id: 'Admin: Akses penuh | Manager: Kelola tim dan operasional | Sales: Kelola inventaris dan pelanggan | Viewer: Akses melihat saja',
            en: 'Admin: Full access | Manager: Team and operations management | Sales: Inventory and customer management | Viewer: View-only access'
          },
          type: 'text'
        },
        {
          title: {
            id: 'Proses Undangan',
            en: 'Invitation Process'
          },
          content: {
            id: 'Tim Anda akan menerima email undangan dengan link untuk membuat akun. Mereka memiliki 7 hari untuk menerima undangan.',
            en: 'Your team will receive an email invitation with a link to create their account. They have 7 days to accept the invitation.'
          },
          type: 'text'
        }
      ],
      tips: [
        'Mulai dengan tim inti terlebih dahulu, tambah anggota lain nanti',
        'Pastikan alamat email anggota tim valid dan aktif',
        'Anda dapat mengubah peran tim setelah onboarding selesai'
      ],
      relatedDocs: ['team-management-guide', 'role-permissions']
    }
  },

  {
    id: OnboardingStep.PREFERENCES,
    title: {
      id: 'Preferensi',
      en: 'Preferences'
    },
    description: {
      id: 'Atur preferensi sistem dan fitur yang ingin Anda gunakan.',
      en: 'Configure system preferences and features you want to use.'
    },
    required: false,
    estimatedTime: 5,
    validation: {
      fields: {
        language: {
          required: false,
          type: 'string',
          options: ['id', 'en']
        },
        timezone: {
          required: false,
          type: 'string'
        },
        currency: {
          required: false,
          type: 'string',
          options: ['IDR', 'USD', 'EUR']
        },
        notificationFrequency: {
          required: false,
          type: 'string',
          options: ['daily', 'weekly', 'monthly', 'never']
        },
        emailNotifications: {
          required: false,
          type: 'string',
          custom: (value: any) => typeof value === 'boolean'
        },
        smsNotifications: {
          required: false,
          type: 'string',
          custom: (value: any) => typeof value === 'boolean'
        },
        whatsappNotifications: {
          required: false,
          type: 'string',
          custom: (value: any) => typeof value === 'boolean'
        },
        features: {
          required: false,
          type: 'array',
          custom: (value: any) => {
            if (!value) return true;
            const validFeatures = ['inventoryManagement', 'customerManagement', 'reporting', 'websiteGeneration', 'aiTools'];
            return Object.keys(value).every(key => validFeatures.includes(key));
          }
        },
        integrations: {
          required: false,
          type: 'array',
          custom: (value: any) => {
            if (!value) return true;
            const validIntegrations = ['accounting', 'crm', 'marketing'];
            return Object.keys(value).every(key => validIntegrations.includes(key));
          }
        }
      }
    },
    helpContent: {
      title: {
        id: 'Bantuan Preferensi',
        en: 'Preferences Help'
      },
      sections: [
        {
          title: {
            id: 'Notifikasi',
            en: 'Notifications'
          },
          content: {
            id: 'Pilih frekuensi dan jenis notifikasi yang ingin Anda terima. Anda dapat mengubah pengaturan ini kapan saja.',
            en: 'Choose the frequency and type of notifications you want to receive. You can change these settings anytime.'
          },
          type: 'text'
        },
        {
          title: {
            id: 'Fitur Sistem',
            en: 'System Features'
          },
          content: {
            id: 'Aktifkan fitur yang sesuai dengan kebutuhan bisnis Anda. Fitur dapat diaktifkan/nonaktifkan kapan saja.',
            en: 'Enable features that match your business needs. Features can be enabled/disabled anytime.'
          },
          type: 'text'
        }
      ],
      tips: [
        'Pilih zona waktu yang sesuai dengan lokasi showroom Anda',
        'Aktifkan notifikasi email untuk pembaruan penting',
        'Fitur AI dapat membantu menghemat waktu pengelolaan inventaris'
      ],
      relatedDocs: ['features-guide', 'notification-settings', 'integrations-overview']
    }
  },

  {
    id: OnboardingStep.COMPLETE,
    title: {
      id: 'Selesai!',
      en: 'Complete!'
    },
    description: {
      id: 'Selamat! Showroom digital Anda siap digunakan. Mari tinjau konfigurasi Anda.',
      en: 'Congratulations! Your digital showroom is ready to use. Let\'s review your configuration.'
    },
    required: true,
    estimatedTime: 3,
    helpContent: {
      title: {
        id: 'Bantuan Penyelesaian',
        en: 'Completion Help'
      },
      sections: [
        {
          title: {
            id: 'Langkah Selanjutnya',
            en: 'Next Steps'
          },
          content: {
            id: 'Setelah onboarding, Anda dapat: menambah inventaris, mengatur website, mengundang lebih banyak tim, dan menjelajahi fitur lainnya.',
            en: 'After onboarding, you can: add inventory, set up website, invite more team members, and explore other features.'
          },
          type: 'text'
        }
      ],
      tips: [
        'Simpan informasi login Anda dengan aman',
        'Kunjungi dashboard untuk memulai menggunakan fitur',
        'Hubungi support jika memerlukan bantuan tambahan'
      ],
      relatedDocs: ['getting-started', 'user-guide', 'support-contact']
    }
  }
];

// Export helper functions
export const getStepDefinition = (step: OnboardingStep): StepDefinition | undefined => {
  return stepDefinitions.find(def => def.id === step);
};

export const getAllSteps = (): OnboardingStep[] => {
  return stepDefinitions.map(def => def.id);
};

export const getRequiredSteps = (): OnboardingStep[] => {
  return stepDefinitions.filter(def => def.required).map(def => def.id);
};

export const getOptionalSteps = (): OnboardingStep[] => {
  return stepDefinitions.filter(def => !def.required).map(def => def.id);
};