// Тактический почерк клубов (сезон 2025/26, приблизительно по реальной игре).
// formation — базовая схема, style — манера, line — высота линии обороны (high | mid | low).
// Стили: possession (владение), pressing (прессинг), counter (контратака), balance, attack, defense.
// Для клубов не из списка тактика подбирается по рейтингу (getClubTactics).
const TEAM_TACTICS = {
    // ---- Европа ----
    "Арсенал":           { formation: '4-3-3',   style: 'pressing',   line: 'high' },
    "Бавария":           { formation: '4-2-3-1', style: 'possession', line: 'high' },
    "Ливерпуль":         { formation: '4-2-3-1', style: 'possession', line: 'high' },
    "Барселона":         { formation: '4-2-3-1', style: 'pressing',   line: 'high' },
    "Реал Мадрид":       { formation: '4-3-3',   style: 'possession', line: 'mid' },
    "Тоттенхэм":         { formation: '4-3-3',   style: 'pressing',   line: 'mid' },
    "ПСЖ":               { formation: '4-3-3',   style: 'pressing',   line: 'high' },
    "Челси":             { formation: '4-2-3-1', style: 'possession', line: 'mid' },
    "Аякс":              { formation: '4-3-3',   style: 'possession', line: 'high' },
    "Манчестер Сити":    { formation: '4-1-4-1', style: 'possession', line: 'high' },
    "Интер":             { formation: '3-5-2',   style: 'balance',    line: 'mid' },
    "Атлетико":          { formation: '4-4-2',   style: 'counter',    line: 'low' },
    "Рома":              { formation: '3-4-2-1', style: 'pressing',   line: 'high' },
    "Боруссия Д":        { formation: '3-4-2-1', style: 'balance',    line: 'mid' },
    "Бенфика":           { formation: '4-2-3-1', style: 'possession', line: 'mid' },
    "Наполи":            { formation: '4-1-4-1', style: 'balance',    line: 'mid' },
    "Аталанта":          { formation: '3-4-2-1', style: 'pressing',   line: 'high' },
    "Айнтрахт":          { formation: '4-2-3-1', style: 'counter',    line: 'mid' },
    "Спортинг":          { formation: '3-4-3',   style: 'possession', line: 'mid' },
    "Порту":             { formation: '4-3-3',   style: 'possession', line: 'high' },
    "Манчестер Юнайтед": { formation: '3-4-2-1', style: 'balance',    line: 'mid' },
    "Брюгге":            { formation: '4-2-3-1', style: 'pressing',   line: 'mid' },
    "Фиорентина":        { formation: '3-5-2',   style: 'counter',    line: 'mid' },
    "Милан":             { formation: '3-5-2',   style: 'counter',    line: 'low' },
    "Бетис":             { formation: '4-2-3-1', style: 'possession', line: 'mid' },
    "Астон Вилла":       { formation: '4-2-3-1', style: 'pressing',   line: 'high' },
    "Ювентус":           { formation: '3-4-2-1', style: 'balance',    line: 'mid' },
    "Севилья":           { formation: '4-2-3-1', style: 'counter',    line: 'mid' },
    "Валенсия":          { formation: '4-4-2',   style: 'counter',    line: 'low' },
    "Ницца":             { formation: '3-4-3',   style: 'pressing',   line: 'mid' },
    "Осасуна":           { formation: '5-3-2',   style: 'counter',    line: 'low' },
    "Жирона":            { formation: '4-3-3',   style: 'possession', line: 'mid' },
    "Лацио":             { formation: '4-3-3',   style: 'possession', line: 'high' },
    "Фейеноорд":         { formation: '4-3-3',   style: 'pressing',   line: 'high' },
    // ---- РПЛ ----
    "Зенит":             { formation: '4-3-3',   style: 'possession', line: 'mid' },
    "Краснодар":         { formation: '4-3-3',   style: 'possession', line: 'high' },
    "Спартак":           { formation: '4-2-3-1', style: 'pressing',   line: 'mid' },
    "ЦСКА":              { formation: '4-4-2',   style: 'balance',    line: 'mid' },
    "Локомотив":         { formation: '4-2-3-1', style: 'attack',     line: 'mid' },
    "Динамо":            { formation: '4-3-3',   style: 'possession', line: 'mid' },
    "Ростов":            { formation: '4-3-3',   style: 'counter',    line: 'mid' },
    "Рубин":             { formation: '5-3-2',   style: 'defense',    line: 'low' },
    "Сочи":              { formation: '4-4-2',   style: 'counter',    line: 'low' },
    "Ахмат":             { formation: '4-2-3-1', style: 'counter',    line: 'mid' },
    "Крылья":            { formation: '4-3-3',   style: 'pressing',   line: 'mid' },
    "Оренбург":          { formation: '4-4-2',   style: 'counter',    line: 'low' },
    "Нижний Новгород":            { formation: '5-3-2',   style: 'defense',    line: 'low' },
    "Факел":             { formation: '5-3-2',   style: 'defense',    line: 'low' },
    "Акрон":             { formation: '4-4-2',   style: 'counter',    line: 'mid' },
    "Балтика":           { formation: '3-5-2',   style: 'balance',    line: 'mid' }
};

// Тактика клуба: из справочника или по силе (сильные владеют мячом, слабые играют от обороны)
function getClubTactics(teamName, rating = 75) {
    const key = (typeof TEAM_ALIAS !== 'undefined' && TEAM_ALIAS[teamName]) || teamName; // переименованный клуб
    if (TEAM_TACTICS[key]) return { ...TEAM_TACTICS[key] };
    if (rating >= 85) return { formation: '4-3-3', style: 'possession', line: 'high' };
    if (rating >= 78) return { formation: '4-2-3-1', style: 'balance', line: 'mid' };
    return { formation: '4-4-2', style: 'counter', line: 'low' };
}
