// ── Повний список контрагентів ────────────────────────────────

export const HOTELS = [
  'Вілла Ксенія', 'Садиба Уляна', 'Готель Столиця', 'Перлина Карпат',
  'Готель Едельвейс', 'Вілла Мозола', 'Вілла Міларо', 'Вілла Львів',
  'Вілла Северин', 'Апартаменти Роксолана', 'Котедж Альціона', 'На Гірській',
  'Вілла Woodman', 'Котедж Загора', 'Вілла Астері', 'Вілла Верховина',
  'Вілла Синевір', 'Східниця - Відпочинок', 'Вілла Корона', 'Вілла Валентина',
  'Котеджі Five House', 'Готель Київ', 'Садиба Мрія', 'Forest Hotel',
  'Вілла Валерія', 'Forest House Exclusive', 'A Hotel', 'Вілла Лаванда',
  'Щасливий дім', 'Velvet Rooms', 'Відпочинок У карпатах', 'Садиба на Зарічній',
  'Вілла Рутенія', 'Аура Карпат', 'Логос', 'Ярдана', 'Сідус',
  'Садіба Оля', '4Р Приватна Садиба', 'Садиба Наталі', 'Готель 3-D Апартаменти',
]

export const TECH_VENDORS = [
  'EasyMS', 'IBAN', 'CRM', 'Хостинг', 'e-chat', 'FinMap',
  'Ringostat', 'Tilda', 'Claude', 'GPT', 'Телефон', 'Get Contact', 'Choko Link',
]

export const MARKETING_VENDORS = ['Facebook', 'Google', 'TikTok']

// ── Категорії ─────────────────────────────────────────────────
export const CATEGORIES = {
  income: [
    { id: 'commission',   label: 'Комісія з бронювань', icon: '🏨', stream: 'hotel' },
    { id: 'subscription', label: 'Щомісячна підписка',  icon: '📋', stream: 'hotel' },
    { id: 'tourism',      label: 'Туристичні групи',     icon: '🚌', stream: 'tourism' },
  ],
  expense: [
    { id: 'tech',       label: 'Технічні витрати',      icon: '🔧' },
    { id: 'staff',      label: 'Підрядники / зарплати', icon: '👥' },
    { id: 'marketing',  label: 'Реклама / маркетинг',   icon: '📣' },
    { id: 'operations', label: 'Операційні витрати',    icon: '🏢' },
    { id: 'tour_costs', label: 'Витрати на тури',       icon: '🗺️' },
    { id: 'taxes',      label: 'Податки',               icon: '🏛️' },
    { id: 'personal',   label: 'Вивід собі',            icon: '👤' },
  ],
}

export const CAT_COLORS = {
  commission: '#2c5f2e', subscription: '#4a7c59', tourism: '#6b9e7a',
  tech: '#dc2626', staff: '#ea580c', marketing: '#ca8a04',
  operations: '#7c3aed', tour_costs: '#db2777', taxes: '#0f766e',
  personal: '#0891b2',
}

// ── Податки (раз на квартал) ──────────────────────────────────
// 5%   — єдиний податок (від доходу)
// 1.5% — військовий збір (від доходу)
// 1300 ₴ — ЄСВ (фіксована сума)
export function calcTaxes(quarterlyIncome) {
  const tax    = Math.round(quarterlyIncome * 0.05)
  const army   = Math.round(quarterlyIncome * 0.015)
  const esv    = 1300
  return { tax, army, esv, total: tax + army + esv }
}
