/**
 * API Route: Embed Templates
 * /api/comcraft/embed-templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

// GET - Fetch all templates
export async function GET(request: NextRequest) {
  try {
    const { data: templates, error } = await supabase
      .from('embed_templates')
      .select('*')
      .order('category', { ascending: true });

    if (error) {
      console.error('Error fetching templates:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Map new column names to old format for frontend compatibility
    const mappedTemplates = (templates || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.template_description, // Template description
      category: t.category,
      title: t.embed_title, // Embed content
      embed_description: t.embed_description,
      color: t.embed_color,
      fields: t.embed_fields,
      footer_text: t.embed_footer_text,
      is_premium: t.is_premium,
      preview_image_url: t.preview_image_url,
      times_used: t.times_used
    }));

    return NextResponse.json({ templates: mappedTemplates });
  } catch (error) {
    console.error('Error in templates API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

