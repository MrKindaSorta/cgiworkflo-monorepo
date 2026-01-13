-- ============================================================================
-- SEED: Default Custom Form for AAR Submission
-- Description: Inserts a default AAR form schema into custom_forms table
-- Date: 2026-01-13
-- ============================================================================
-- This seed ensures the database has an active form for AAR submissions.
-- Without this, users get "Active form not found" error when submitting.
-- ============================================================================

INSERT INTO custom_forms (
  id,
  name,
  description,
  form_schema,
  is_active,
  applies_to_category,
  created_by,
  created_at,
  updated_at
) VALUES (
  'form_default_aar',
  'Default AAR Form',
  'Standard After Action Report submission form with essential fields',
  '{
    "formId": "aar-form",
    "version": "1.0",
    "sections": [
      {"id": "basic", "name": "Basic Information", "order": 0},
      {"id": "damage", "name": "Damage Information", "order": 1},
      {"id": "repair", "name": "Repair Details", "order": 2},
      {"id": "photos", "name": "Photos & Attachments", "order": 3}
    ],
    "fields": [
      {
        "id": "category",
        "type": "select",
        "label": "Category",
        "placeholder": "Select Category",
        "required": true,
        "order": 0,
        "section": "basic",
        "options": ["Vehicle", "Boat", "Motorcycle", "Apparel", "Accessory", "Furniture", "Aircraft", "Marine", "Medical", "Commercial"]
      },
      {
        "id": "model",
        "type": "text",
        "label": "Model",
        "placeholder": "Enter model",
        "required": false,
        "order": 1,
        "section": "basic"
      },
      {
        "id": "year",
        "type": "text",
        "label": "Year",
        "placeholder": "Enter year",
        "required": false,
        "order": 2,
        "section": "basic"
      },
      {
        "id": "damageType",
        "type": "select",
        "label": "Damage Type",
        "placeholder": "Select damage type",
        "required": true,
        "order": 0,
        "section": "damage",
        "options": ["Tear", "Crack", "Scuff", "Burn", "Stain", "Fade", "Wear"]
      },
      {
        "id": "damageDescription",
        "type": "textarea",
        "label": "Damage Description",
        "placeholder": "Describe the damage",
        "required": true,
        "order": 1,
        "section": "damage"
      },
      {
        "id": "repairTime",
        "type": "number",
        "label": "Repair Time (hours)",
        "placeholder": "Enter hours",
        "required": false,
        "order": 0,
        "section": "repair",
        "validation": {"min": 0}
      },
      {
        "id": "processDescription",
        "type": "textarea",
        "label": "Repair Process",
        "placeholder": "Describe the repair process",
        "required": false,
        "order": 1,
        "section": "repair"
      },
      {
        "id": "beforePhotos",
        "type": "file",
        "label": "Before Photos",
        "placeholder": "Upload before photos",
        "required": false,
        "order": 0,
        "section": "photos",
        "multiple": true,
        "accept": "image/*"
      },
      {
        "id": "afterPhotos",
        "type": "file",
        "label": "After Photos",
        "placeholder": "Upload after photos",
        "required": false,
        "order": 1,
        "section": "photos",
        "multiple": true,
        "accept": "image/*"
      }
    ]
  }',
  1,
  NULL,
  'user_1767901348877_cej6dsh',
  datetime('now'),
  datetime('now')
);

-- ============================================================================
-- Verification:
-- wrangler d1 execute cgiworkflo-db-production --command "SELECT id, name, is_active, created_by FROM custom_forms" --remote
-- ============================================================================
