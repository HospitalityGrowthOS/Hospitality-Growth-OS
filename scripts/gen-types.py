"""Generate a Supabase Database type from the live PostgREST OpenAPI spec.

PostgREST reports, per column: type/format, whether it's required (NOT NULL),
and whether it has a default. That's enough to emit accurate Row / Insert /
Update shapes:
  Row     — every column; nullable ones get `| null`
  Insert  — required columns without a default are mandatory, rest optional
  Update  — everything optional
"""
import json, os, re, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'src', 'types', 'database.ts')


def load_env(path):
    env = {}
    if os.path.exists(path):
        for line in open(path):
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                env[k] = v
    return env


env = load_env(os.path.join(HERE, '..', '.env.local'))
url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL') or env.get('NEXT_PUBLIC_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or env.get('SUPABASE_SERVICE_ROLE_KEY')
if not url or not key:
    sys.exit('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or add them to .env.local)')

req = urllib.request.Request(
    url.rstrip('/') + '/rest/v1/',
    headers={'apikey': key, 'Authorization': f'Bearer {key}', 'Accept-Profile': 'public'},
)
spec = json.loads(urllib.request.urlopen(req).read())
defs = spec['definitions']


def ts_type(prop):
    # Postgres enums arrive with an explicit value list. Emitting them as a
    # union rather than `string` is what makes an invalid value a compile
    # error instead of a runtime 22P02.
    values = prop.get('enum')
    if values:
        return ' | '.join(f"'{v}'" for v in values)

    fmt = prop.get('format', '')
    t = prop.get('type', 'string')
    if fmt in ('integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision'):
        return 'number'
    if t == 'integer' or t == 'number':
        return 'number'
    if t == 'boolean':
        return 'boolean'
    if t == 'array':
        return 'string[]'
    if fmt == 'jsonb' or fmt == 'json':
        return 'Json'
    return 'string'


FK_RE = re.compile(r"<fk table='([^']+)' column='([^']+)'/>")


def foreign_keys(schema):
    """PostgREST documents FKs in the column description, e.g.
       "This is a Foreign Key to `venues.id`.<fk table='venues' column='id'/>"
       postgrest-js needs these to resolve embedded selects at the type level;
       without them every `table(col)` embed widens to never."""
    out = []
    for col, prop in schema.get('properties', {}).items():
        m = FK_RE.search(prop.get('description', '') or '')
        if m:
            out.append((col, m.group(1), m.group(2)))
    return out


def emit_table(name, schema):
    props = schema.get('properties', {})
    required = set(schema.get('required', []))

    rows, inserts, updates = [], [], []
    for col, prop in props.items():
        base = ts_type(prop)
        nullable = col not in required
        has_default = 'default' in prop

        rows.append(f'          {col}: {base}{" | null" if nullable else ""}')

        # Mandatory on insert only when NOT NULL and no default to fall back on.
        if col in required and not has_default:
            inserts.append(f'          {col}: {base}')
        else:
            inserts.append(f'          {col}?: {base}{" | null" if nullable else ""}')

        updates.append(f'          {col}?: {base}{" | null" if nullable else ""}')

    fks = foreign_keys(schema)
    if fks:
        rels = [
            '\n          {\n'
            f'            foreignKeyName: "{name}_{col}_fkey"\n'
            f'            columns: ["{col}"]\n'
            '            isOneToOne: false\n'
            f'            referencedRelation: "{ftable}"\n'
            f'            referencedColumns: ["{fcol}"]\n'
            '          }'
            for col, ftable, fcol in fks
        ]
        rel_block = ','.join(rels) + '\n        '
    else:
        rel_block = ''

    return f"""      {name}: {{
        Row: {{
{chr(10).join(rows)}
        }}
        Insert: {{
{chr(10).join(inserts)}
        }}
        Update: {{
{chr(10).join(updates)}
        }}
        Relationships: [{rel_block}]
      }}"""


tables = sorted(k for k, v in defs.items() if 'properties' in v)
blocks = [emit_table(t, defs[t]) for t in tables]

header = """// Generated from the live Supabase schema — do not edit by hand.
// Regenerate with: npm run gen:types
//
// Every table carries `Relationships: []` because @supabase/postgrest-js
// requires it to recognise the schema as a GenericSchema; without it every
// query resolves to `never`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
"""

footer = """
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// ── Convenience aliases ───────────────────────────────────────────────────────
type T = Database['public']['Tables']
"""

alias_names = {
    'venues': 'Venue', 'guests': 'Guest', 'visits': 'Visit',
    'loyalty_members': 'LoyaltyMember', 'loyalty_transactions': 'LoyaltyTransaction',
    'loyalty_rewards': 'LoyaltyReward', 'reviews': 'Review',
    'review_requests': 'ReviewRequest', 'campaigns': 'Campaign',
    'campaign_sends': 'CampaignSend', 'conversations': 'Conversation',
    'messages': 'Message', 'action_items': 'ActionItem',
    'ai_recommendations': 'AiRecommendation', 'analytics_events': 'AnalyticsEvent',
    'kpi_snapshots': 'KpiSnapshot', 'notifications': 'Notification',
    'profiles': 'Profile', 'subscriptions': 'Subscription',
    'weekly_reports': 'WeeklyReport', 'whatsapp_messages': 'WhatsAppMessage',
    'leads': 'Lead',
}
aliases = [
    f"export type {alias} = T['{tbl}']['Row']"
    for tbl, alias in alias_names.items() if tbl in defs
]

open(OUT, 'w').write(header + '\n'.join(blocks) + footer + '\n'.join(aliases) + '\n')
print(f'wrote {len(tables)} tables, {len(aliases)} aliases -> {OUT}')
