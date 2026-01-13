/**
 * AAR (After Action Report) Routes
 *
 * Handles CRUD operations for AARs with:
 * - JSON-based dynamic form data
 * - Photo uploads to R2
 * - Full-text search with FTS5
 * - Filtering and pagination
 * - Form schema validation
 */

import { Hono } from 'hono';
import { authenticate } from '../middleware/auth';
import { validateAARSubmission, extractCommonFields } from '../lib/validateAARSubmission';
import type { Env, Variables } from '../types/env';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// All routes require authentication
app.use('/*', authenticate);

/**
 * POST /api/aars
 * Create new AAR with form data and photo uploads
 *
 * Request format: multipart/form-data
 * - formData: JSON string containing form field values
 * - formId: Custom form ID used
 * - formVersion: Form version string
 * - photo_<fieldId>_<index>: File uploads (can have multiple per field)
 * - photoMetadata: JSON string mapping fieldId to photo metadata
 */
app.post('/', async (c) => {
  try {
    const user = c.get('user')!; // Non-null assertion: authenticate middleware ensures user is set

    // Parse multipart form data
    const formDataRaw = await c.req.parseBody();

    // Extract form data
    const formDataStr = formDataRaw.formData as string;
    const formId = formDataRaw.formId as string;
    const formVersion = formDataRaw.formVersion as string;
    const photoMetadataStr = formDataRaw.photoMetadata as string;

    if (!formDataStr || !formId || !formVersion) {
      return c.json(
        {
          success: false,
          message: 'Missing required fields: formData, formId, formVersion',
        },
        400
      );
    }

    // Parse JSON data
    let formData: Record<string, any>;
    let photoMetadata: Record<string, any>;

    try {
      formData = JSON.parse(formDataStr);
      photoMetadata = photoMetadataStr ? JSON.parse(photoMetadataStr) : {};
    } catch (err) {
      return c.json(
        {
          success: false,
          message: 'Invalid JSON in formData or photoMetadata',
        },
        400
      );
    }

    // Fetch active custom form schema for validation
    let formResult = await c.env.DB.prepare(
      'SELECT id, form_schema FROM custom_forms WHERE id = ? AND is_active = 1 AND deleted_at IS NULL'
    )
      .bind(formId)
      .first();

    // Fallback: Get any active form if specific ID not found
    if (!formResult) {
      formResult = await c.env.DB.prepare(
        'SELECT id, form_schema FROM custom_forms WHERE is_active = 1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1'
      ).first();
    }

    if (!formResult) {
      return c.json(
        {
          success: false,
          message: 'No active form found',
        },
        400
      );
    }

    const formSchema = JSON.parse(formResult.form_schema as string);

    // Validate form submission
    const validation = await validateAARSubmission(formData, formSchema, photoMetadata);

    if (!validation.valid) {
      return c.json(
        {
          success: false,
          message: 'Validation failed',
          errors: validation.errors,
        },
        400
      );
    }

    // Generate AAR ID
    const aarId = `aar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Upload photos to R2 and collect URLs
    const photoUrls: Record<string, string[]> = {};

    for (const [key, value] of Object.entries(formDataRaw)) {
      // Check if this is a photo field (format: photo_<fieldId>_<index>)
      if (key.startsWith('photo_')) {
        const parts = key.split('_');
        if (parts.length >= 3) {
          const fieldId = parts.slice(1, -1).join('_'); // Handle field IDs with underscores
          const file = value as File;

          if (file && file.size > 0) {
            // Generate R2 key
            const ext = file.name.split('.').pop() || 'jpg';
            const timestamp = Date.now();
            const random = Math.random().toString(36).substr(2, 9);
            const r2Key = `aars/${user.id}/${aarId}/${fieldId}/${timestamp}-${random}.${ext}`;

            // Upload to R2
            const arrayBuffer = await file.arrayBuffer();
            await c.env.PHOTOS.put(r2Key, arrayBuffer, {
              httpMetadata: {
                contentType: file.type,
              },
            });

            // Store URL
            if (!photoUrls[fieldId]) {
              photoUrls[fieldId] = [];
            }
            photoUrls[fieldId].push(r2Key);

            // Insert photo metadata into database
            const photoId = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await c.env.DB.prepare(
              `INSERT INTO photos (id, aar_id, field_id, type, r2_key, filename, mime_type, size, display_order, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
            )
              .bind(
                photoId,
                aarId,
                fieldId,
                fieldId.includes('before') ? 'before' : 'after', // Legacy type field
                r2Key,
                file.name,
                file.type,
                file.size,
                photoUrls[fieldId].length - 1
              )
              .run();
          }
        }
      }
    }

    // Merge photo URLs into form data
    const formDataWithPhotos = {
      ...formData,
      _photoUrls: photoUrls, // Store photo URLs in special field
    };

    // Extract common fields for indexing
    const commonFields = extractCommonFields(formData);

    // Insert AAR record
    await c.env.DB.prepare(
      `INSERT INTO aars (id, user_id, category, material, damage_type, form_id, form_version, form_data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
      .bind(
        aarId,
        user.id,
        commonFields.category,
        commonFields.material,
        commonFields.damage_type,
        formId,
        formVersion,
        JSON.stringify(formDataWithPhotos)
      )
      .run();

    // Fetch created AAR
    const createdAAR = await c.env.DB.prepare(
      `SELECT * FROM aars WHERE id = ?`
    )
      .bind(aarId)
      .first();

    if (!createdAAR) {
      return c.json(
        {
          success: false,
          message: 'Failed to retrieve created AAR',
        },
        500
      );
    }

    return c.json({
      success: true,
      data: {
        aar: {
          ...createdAAR,
          form_data: JSON.parse(createdAAR.form_data as string),
        },
        photoUrls,
      },
    });
  } catch (error) {
    console.error('Error creating AAR:', error);
    return c.json(
      {
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/aars
 * List AARs with filtering, search, and pagination
 *
 * Query params:
 * - search: Full-text search query
 * - category: Filter by category
 * - material: Filter by material
 * - damageType: Filter by damage type
 * - dateFrom, dateTo: Date range filter
 * - userId: Filter by user
 * - sortBy: Sort order (recent, upvotes, views)
 * - page, limit: Pagination
 */
app.get('/', async (c) => {
  try {
    const {
      search,
      category,
      material,
      damageType,
      dateFrom,
      dateTo,
      userId,
      sortBy = 'recent',
      page = '1',
      limit = '20',
    } = c.req.query();

    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 20, 100); // Max 100 items per page
    const offset = (pageNum - 1) * limitNum;

    let query = '';
    let countQuery = '';
    const bindings: any[] = [];
    const countBindings: any[] = [];

    if (search && search.trim() !== '') {
      // Use FTS5 for full-text search
      const ftsQuery = search.trim().replace(/[^\w\s]/g, ''); // Sanitize

      query = `
        SELECT
          a.id, a.user_id, a.category, a.material, a.damage_type,
          a.form_id, a.form_version, a.form_data,
          a.upvotes, a.downvotes, a.views, a.comment_count,
          a.created_at, a.updated_at,
          fts.rank,
          u.name as user_name, u.email as user_email
        FROM aars_fts fts
        JOIN aars a ON a.id = fts.aar_id
        JOIN users u ON u.id = a.user_id
        WHERE aars_fts MATCH ?
          AND a.deleted_at IS NULL
      `;
      bindings.push(ftsQuery);

      countQuery = `
        SELECT COUNT(*) as total
        FROM aars_fts fts
        JOIN aars a ON a.id = fts.aar_id
        WHERE aars_fts MATCH ?
          AND a.deleted_at IS NULL
      `;
      countBindings.push(ftsQuery);
    } else {
      // Standard query without FTS
      query = `
        SELECT
          a.id, a.user_id, a.category, a.material, a.damage_type,
          a.form_id, a.form_version, a.form_data,
          a.upvotes, a.downvotes, a.views, a.comment_count,
          a.created_at, a.updated_at,
          u.name as user_name, u.email as user_email
        FROM aars a
        JOIN users u ON u.id = a.user_id
        WHERE a.deleted_at IS NULL
      `;

      countQuery = `
        SELECT COUNT(*) as total
        FROM aars a
        WHERE a.deleted_at IS NULL
      `;
    }

    // Add filters
    if (category) {
      query += ' AND a.category = ?';
      countQuery += ' AND a.category = ?';
      bindings.push(category);
      countBindings.push(category);
    }

    if (material) {
      query += ' AND a.material = ?';
      countQuery += ' AND a.material = ?';
      bindings.push(material);
      countBindings.push(material);
    }

    if (damageType) {
      query += ' AND a.damage_type = ?';
      countQuery += ' AND a.damage_type = ?';
      bindings.push(damageType);
      countBindings.push(damageType);
    }

    if (userId) {
      query += ' AND a.user_id = ?';
      countQuery += ' AND a.user_id = ?';
      bindings.push(userId);
      countBindings.push(userId);
    }

    if (dateFrom) {
      query += ' AND a.created_at >= ?';
      countQuery += ' AND a.created_at >= ?';
      bindings.push(dateFrom);
      countBindings.push(dateFrom);
    }

    if (dateTo) {
      query += ' AND a.created_at <= ?';
      countQuery += ' AND a.created_at <= ?';
      bindings.push(dateTo);
      countBindings.push(dateTo);
    }

    // Add sorting
    switch (sortBy) {
      case 'upvotes':
        query += ' ORDER BY a.upvotes DESC, a.created_at DESC';
        break;
      case 'views':
        query += ' ORDER BY a.views DESC, a.created_at DESC';
        break;
      case 'recent':
      default:
        query += search ? ' ORDER BY fts.rank' : ' ORDER BY a.created_at DESC';
        break;
    }

    // Add pagination
    query += ' LIMIT ? OFFSET ?';
    bindings.push(limitNum, offset);

    // Execute queries
    const [aarsResult, countResult] = await Promise.all([
      c.env.DB.prepare(query).bind(...bindings).all(),
      c.env.DB.prepare(countQuery).bind(...countBindings).first(),
    ]);

    // Parse form_data JSON for each AAR
    const aars = (aarsResult.results || []).map((aar: any) => ({
      ...aar,
      form_data: JSON.parse(aar.form_data),
    }));

    const total = (countResult?.total as number) || 0;
    const totalPages = Math.ceil(total / limitNum);

    return c.json({
      success: true,
      data: {
        aars,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error('Error listing AARs:', error);
    return c.json(
      {
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/aars/:id
 * Get single AAR by ID with photos and user info
 */
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const user = c.get('user')!; // Non-null assertion: authenticate middleware ensures user is set

    // Fetch AAR with user info
    const aar = await c.env.DB.prepare(
      `SELECT
        a.*,
        u.name as user_name,
        u.email as user_email,
        u.role as user_role
       FROM aars a
       JOIN users u ON u.id = a.user_id
       WHERE a.id = ? AND a.deleted_at IS NULL`
    )
      .bind(id)
      .first();

    if (!aar) {
      return c.json(
        {
          success: false,
          message: 'AAR not found',
        },
        404
      );
    }

    // Fetch photos grouped by field_id
    const photosResult = await c.env.DB.prepare(
      `SELECT id, field_id, type, r2_key, filename, mime_type, size, display_order, created_at
       FROM photos
       WHERE aar_id = ?
       ORDER BY field_id, display_order`
    )
      .bind(id)
      .all();

    // Group photos by field_id
    const photosByField: Record<string, any[]> = {};
    for (const photo of photosResult.results || []) {
      const fieldId = photo.field_id as string;
      if (!photosByField[fieldId]) {
        photosByField[fieldId] = [];
      }
      photosByField[fieldId].push(photo);
    }

    // Track view (insert into aar_views table)
    // This will trigger the aar_views_insert trigger which increments views count
    try {
      const viewId = `view_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await c.env.DB.prepare(
        `INSERT INTO aar_views (id, aar_id, user_id, viewed_at)
         VALUES (?, ?, ?, datetime('now'))`
      )
        .bind(viewId, id, user.id)
        .run();
    } catch (viewError) {
      // Ignore view tracking errors (e.g., duplicate views)
      console.warn('View tracking error:', viewError);
    }

    return c.json({
      success: true,
      data: {
        aar: {
          ...aar,
          form_data: JSON.parse(aar.form_data as string),
        },
        photos: photosByField,
      },
    });
  } catch (error) {
    console.error('Error fetching AAR:', error);
    return c.json(
      {
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * PUT /api/aars/:id
 * Update an existing AAR
 * (Future implementation)
 */
app.put('/:id', async (c) => {
  return c.json(
    {
      success: false,
      message: 'Update AAR not yet implemented',
    },
    501
  );
});

/**
 * DELETE /api/aars/:id
 * Soft delete an AAR
 */
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const user = c.get('user')!; // Non-null assertion: authenticate middleware ensures user is set

    // Fetch AAR to check ownership
    const aar = await c.env.DB.prepare(
      'SELECT user_id FROM aars WHERE id = ? AND deleted_at IS NULL'
    )
      .bind(id)
      .first();

    if (!aar) {
      return c.json(
        {
          success: false,
          message: 'AAR not found',
        },
        404
      );
    }

    // Check permissions (only owner, admin, or manager can delete)
    if (
      aar.user_id !== user.id &&
      user.role !== 'admin' &&
      user.role !== 'manager'
    ) {
      return c.json(
        {
          success: false,
          message: 'You do not have permission to delete this AAR',
        },
        403
      );
    }

    // Soft delete
    await c.env.DB.prepare(
      `UPDATE aars SET deleted_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(id)
      .run();

    return c.json({
      success: true,
      message: 'AAR deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting AAR:', error);
    return c.json(
      {
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default app;
