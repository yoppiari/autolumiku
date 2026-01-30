# Changelogs & Fix Documentation

This directory contains detailed changelogs and fix documentation for major features and bug fixes in the Autolumiku project.

## 📋 Index

### Recent Changes (2026-01-30)

1. **[INTENT_CLASSIFICATION_FIX.md](./INTENT_CLASSIFICATION_FIX.md)**
   - **Date**: 2026-01-30
   - **Commit**: `8af32e1`
   - **Summary**: Fixed AI misclassifying contact/location inquiries as vehicle inquiries
   - **Impact**: 
     - ✅ "Salesnya siapa?" → Now returns contact info (not vehicle list)
     - ✅ "Lokasi showroom dimana?" → Now returns location info (not vehicle list)
     - ✅ Stop command false positives reduced from ~30% to <5%

2. **[LEAD_CAPTURE_CHANGELOG.md](./LEAD_CAPTURE_CHANGELOG.md)**
   - **Date**: 2026-01-30
   - **Commit**: `84bc763`, `173e33d`
   - **Summary**: Enhanced lead capture with entity extraction (vehicle models, budget)
   - **Impact**:
     - ✅ Auto-populate `interestedIn` field (e.g., "Toyota Avanza")
     - ✅ Auto-populate `budgetRange` field (e.g., "< Rp 200 Juta")
     - ✅ Context-aware lead scoring with AI

## 📁 File Naming Convention

Files in this directory follow this naming pattern:
- `FEATURE_NAME_CHANGELOG.md` - For new features
- `FEATURE_NAME_FIX.md` - For bug fixes
- `YYYY-MM-DD_DESCRIPTION.md` - For date-specific changes

## 🔗 Related Documentation

- [Architecture](../architecture.md) - System architecture overview
- [Deployment Guide](../deployment-guide.md) - Deployment procedures
- [WhatsApp AI Flow](../WHATSAPP_LLM_FLOW_ANALYSIS.md) - WhatsApp AI integration details

## 📝 How to Add New Changelog

When adding a new changelog:

1. Create a new `.md` file in this directory
2. Use the naming convention above
3. Include:
   - Date and commit hash
   - Problem statement
   - Solution implemented
   - Impact/metrics
   - Testing checklist
4. Update this README.md index

## 🏷️ Tags

- `#ai-enhancement` - AI/LLM improvements
- `#lead-management` - CRM/Lead features
- `#bug-fix` - Bug fixes
- `#performance` - Performance optimizations
- `#whatsapp` - WhatsApp integration changes
