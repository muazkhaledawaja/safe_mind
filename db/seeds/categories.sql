-- Seed: the eight awareness categories
INSERT IGNORE INTO categories (name_ar, name_en, slug, sort_order) VALUES
  ('الاكتئاب',                 'Depression',            'depression',        1),
  ('القلق',                    'Anxiety',               'anxiety',           2),
  ('الصدمات والحروب',          'Trauma and War',        'trauma-war',        3),
  ('الوسواس القهري',           'OCD',                   'ocd',               4),
  ('الاضطرابات النمائية',      'Developmental Disorders','developmental',    5),
  ('مشاكل النوم',              'Sleep Problems',        'sleep',             6),
  ('الدعم الطارئ',             'Emergency Support',     'emergency-support', 7),
  ('الرعاية الذاتية',          'Self Care',             'self-care',         8);
