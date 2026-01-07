import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { authenticate, requireRole } from '../middleware/auth';
import type { Env, Variables } from '../types/env';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

// Field validation schema
const fieldValidator = z.object({
  id: z.string(),
  type: z.enum([
    'text',
    'textarea',
    'number',
    'select',
    'multiselect',
    'smartselect',
    'smartmultiselect',
    'date',
    'file',
    'dualfield',
    'multidualfield',
    'triplefield',
    'multitriplefield',
  ]),
  label: z.string(),
  placeholder: z.string().optional(),
  required: z.boolean(),
  order: z.number(),
  section: z.string(),
  options: z.array(z.string()).optional(),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      minLength: z.number().optional(),
      minDate: z.string().optional(),
      maxDate: z.string().optional(),
    })
    .optional(),
  multiple: z.boolean().optional(),
  accept: z.string().optional(),
  allowCreate: z.boolean().optional(),
  unitOptions: z.array(z.string()).optional(),
  unitLabel: z.string().optional(),
  amountLabel: z.string().optional(),
});

// Section validation schema
const sectionValidator = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number(),
});

// Complete form schema validator
const formSchemaValidator = z.object({
  formId: z.string(),
  version: z.string(),
  sections: z.array(sectionValidator).min(1, 'At least one section is required'),
  fields: z.array(fieldValidator),
});

// Update form request schema
const updateFormSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional(),
  form_schema: formSchemaValidator,
});

// Reset form request schema
const resetFormSchema = z.object({
  defaultSchema: formSchemaValidator,
});

// ============================================================================
// ROUTES
// ============================================================================

// GET /api/custom-forms/active - Get the currently active form
app.get('/active', authenticate, async (c) => {
  try {
    const activeForm = await c.env.DB.prepare(
      `SELECT id, name, description, form_schema, created_at, updated_at
       FROM custom_forms
       WHERE is_active = 1 AND deleted_at IS NULL
       LIMIT 1`
    ).first();

    if (!activeForm) {
      // No active form exists - frontend will use default schema
      return c.json({ form: null });
    }

    // Parse form_schema from JSON string
    let schema;
    try {
      schema = JSON.parse(activeForm.form_schema as string);
    } catch (parseError) {
      console.error('Error parsing form schema:', parseError);
      return c.json({ error: 'Invalid form schema in database' }, 500);
    }

    return c.json({
      form: {
        id: activeForm.id,
        name: activeForm.name,
        description: activeForm.description,
        schema,
        createdAt: activeForm.created_at,
        updatedAt: activeForm.updated_at,
      },
    });
  } catch (error) {
    console.error('Error fetching active form:', error);
    return c.json({ error: 'Failed to fetch form' }, 500);
  }
});

// PUT /api/custom-forms/active - Update or create the active form
app.put('/active', authenticate, requireRole('admin', 'manager'), async (c) => {
  try {
    const currentUser = c.get('user');
    if (!currentUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const validated = updateFormSchema.parse(body);

    // Additional validation: Ensure field sections reference existing sections
    const sectionIds = new Set(validated.form_schema.sections.map((s) => s.id));
    const invalidFields = validated.form_schema.fields.filter(
      (f) => !sectionIds.has(f.section)
    );

    if (invalidFields.length > 0) {
      return c.json(
        {
          error: 'Validation error',
          message: `Fields reference non-existent sections: ${invalidFields
            .map((f) => f.id)
            .join(', ')}`,
        },
        400
      );
    }

    // Check for duplicate field IDs
    const fieldIds = validated.form_schema.fields.map((f) => f.id);
    const duplicateIds = fieldIds.filter((id, index) => fieldIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      return c.json(
        {
          error: 'Validation error',
          message: `Duplicate field IDs found: ${duplicateIds.join(', ')}`,
        },
        400
      );
    }

    const formSchemaJson = JSON.stringify(validated.form_schema);

    // Check if active form exists
    const existingForm = await c.env.DB.prepare(
      'SELECT id FROM custom_forms WHERE is_active = 1 AND deleted_at IS NULL LIMIT 1'
    ).first();

    if (existingForm) {
      // Update existing active form
      await c.env.DB.prepare(
        `UPDATE custom_forms
         SET form_schema = ?,
             name = COALESCE(?, name),
             description = COALESCE(?, description),
             updated_at = datetime('now')
         WHERE id = ?`
      )
        .bind(
          formSchemaJson,
          validated.name || null,
          validated.description || null,
          existingForm.id
        )
        .run();

      return c.json({
        success: true,
        message: 'Form updated successfully',
        formId: existingForm.id,
      });
    } else {
      // Create new active form (first time setup or after reset)
      const formId = nanoid();
      await c.env.DB.prepare(
        `INSERT INTO custom_forms (id, name, description, form_schema, is_active, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`
      )
        .bind(
          formId,
          validated.name || 'AAR Submission Form',
          validated.description || 'Customized AAR submission form',
          formSchemaJson,
          currentUser.id
        )
        .run();

      return c.json(
        {
          success: true,
          message: 'Form created successfully',
          formId,
        },
        201
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          error: 'Validation error',
          details: error.flatten().fieldErrors,
        },
        400
      );
    }

    console.error('Error updating form:', error);
    return c.json({ error: 'Failed to update form' }, 500);
  }
});

// POST /api/custom-forms/reset - Reset to default schema
app.post('/reset', authenticate, requireRole('admin', 'manager'), async (c) => {
  try {
    const currentUser = c.get('user');
    if (!currentUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const validated = resetFormSchema.parse(body);

    // Soft delete current active form (preserve history)
    await c.env.DB.prepare(
      `UPDATE custom_forms
       SET deleted_at = datetime('now'), is_active = 0
       WHERE is_active = 1 AND deleted_at IS NULL`
    ).run();

    // Create new form with default schema
    const formId = nanoid();
    await c.env.DB.prepare(
      `INSERT INTO custom_forms (id, name, description, form_schema, is_active, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`
    )
      .bind(
        formId,
        'AAR Submission Form',
        'Default AAR submission form',
        JSON.stringify(validated.defaultSchema),
        currentUser.id
      )
      .run();

    return c.json({
      success: true,
      message: 'Form reset to default',
      formId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          error: 'Validation error',
          details: error.flatten().fieldErrors,
        },
        400
      );
    }

    console.error('Error resetting form:', error);
    return c.json({ error: 'Failed to reset form' }, 500);
  }
});

export default app;
