# Обновляет составы клубов по разделу «Текущий состав» статей русской Википедии.
# Запуск:  powershell -ExecutionPolicy Bypass -File tools\update-squads.ps1
# Пишет:   js\data\squads.js (составы) и js\data\birthyears.js (годы рождения → возраст)
# Порядок в линии: игроки, уже бывшие в клубе, сохраняют прежнее место (первые — в старте);
# новички встают по возрасту (в расцвете сил — к основе, совсем молодые — в конец).
param([string[]]$Only = @())   # можно обновить только эти клубы: -Only 'Барселона','Зенит'

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$ua = 'FootballSimDataBot/1.0 (squad update script)'
$season = 2026

# Клуб в игре → [лига в игре, статья Википедии]
$clubs = [ordered]@{
    'Арсенал' = @('world', 'Арсенал_(футбольный_клуб,_Лондон)'); 'Бавария' = @('world', 'Бавария_(футбольный_клуб)')
    'Ливерпуль' = @('world', 'Ливерпуль_(футбольный_клуб)'); 'Барселона' = @('world', 'Барселона_(футбольный_клуб)')
    'Реал Мадрид' = @('world', 'Реал_Мадрид'); 'Тоттенхэм' = @('world', 'Тоттенхэм_Хотспур')
    'ПСЖ' = @('world', 'Пари_Сен-Жермен'); 'Челси' = @('world', 'Челси_(футбольный_клуб)')
    'Аякс' = @('world', 'Аякс_(футбольный_клуб,_Амстердам)'); 'Манчестер Сити' = @('world', 'Манчестер_Сити')
    'Интер' = @('world', 'Интернационале'); 'Атлетико' = @('world', 'Атлетико_Мадрид')
    'Рома' = @('world', 'Рома_(футбольный_клуб)'); 'Боруссия Д' = @('world', 'Боруссия_(футбольный_клуб,_Дортмунд)')
    'Бенфика' = @('world', 'Бенфика_(футбольный_клуб,_Лиссабон)'); 'Наполи' = @('world', 'Наполи_(футбольный_клуб)')
    'Аталанта' = @('world', 'Аталанта_(футбольный_клуб)'); 'Айнтрахт' = @('world', 'Айнтрахт_(футбольный_клуб,_Франкфурт-на-Майне)')
    'Спортинг' = @('world', 'Спортинг_(футбольный_клуб,_Лиссабон)'); 'Порту' = @('world', 'Порту_(футбольный_клуб)')
    'Манчестер Юнайтед' = @('world', 'Манчестер_Юнайтед'); 'Брюгге' = @('world', 'Брюгге_(футбольный_клуб)')
    'Фиорентина' = @('world', 'Фиорентина'); 'Милан' = @('world', 'Милан_(футбольный_клуб)')
    'Бетис' = @('world', 'Реал_Бетис'); 'Астон Вилла' = @('world', 'Астон_Вилла')
    'Ювентус' = @('world', 'Ювентус'); 'Севилья' = @('world', 'Севилья_(футбольный_клуб)')
    'Валенсия' = @('world', 'Валенсия_(футбольный_клуб)'); 'Ницца' = @('world', 'Ницца_(футбольный_клуб)')
    'Осасуна' = @('world', 'Осасуна'); 'Жирона' = @('world', 'Жирона_(футбольный_клуб)')
    'Лацио' = @('world', 'Лацио_(футбольный_клуб)'); 'Фейеноорд' = @('world', 'Фейеноорд')
    'Спартак' = @('russia', 'Спартак_(футбольный_клуб,_Москва)'); 'Зенит' = @('russia', 'Зенит_(футбольный_клуб,_Санкт-Петербург)')
    'ЦСКА' = @('russia', 'ЦСКА_(футбольный_клуб,_Москва)'); 'Локомотив' = @('russia', 'Локомотив_(футбольный_клуб,_Москва)')
    'Динамо' = @('russia', 'Динамо_(футбольный_клуб,_Москва)'); 'Краснодар' = @('russia', 'Краснодар_(футбольный_клуб)')
    'Ростов' = @('russia', 'Ростов_(футбольный_клуб)'); 'Рубин' = @('russia', 'Рубин_(футбольный_клуб)')
    'Сочи' = @('russia', 'Сочи_(футбольный_клуб)'); 'Ахмат' = @('russia', 'Ахмат_(футбольный_клуб)')
    'Крылья' = @('russia', 'Крылья_Советов_(футбольный_клуб,_Самара)'); 'Оренбург' = @('russia', 'Оренбург_(футбольный_клуб)')
    'Нижний Новгород' = @('russia', 'Нижний_Новгород_(футбольный_клуб,_2015)'); 'Факел' = @('russia', 'Факел_(футбольный_клуб,_Воронеж)')
    'Акрон' = @('russia', 'Акрон_(футбольный_клуб)'); 'Балтика' = @('russia', 'Балтика_(футбольный_клуб)')
    'Родина' = @('russia', 'Родина_(футбольный_клуб)'); 'Динамо Мх' = @('russia', 'Динамо_(футбольный_клуб,_Махачкала)')
    # Европа — добавлены в ноябре 2026
    'Байер' = @('world', 'Байер_04'); 'РБ Лейпциг' = @('world', 'РБ_Лейпциг')
    'ПСВ' = @('world', 'ПСВ_(футбольный_клуб)'); 'Ньюкасл' = @('world', 'Ньюкасл_Юнайтед')
    'Марсель' = @('world', 'Олимпик_Марсель'); 'Монако' = @('world', 'Монако_(футбольный_клуб)')
    'Галатасарай' = @('world', 'Галатасарай_(футбольный_клуб)'); 'Фенербахче' = @('world', 'Фенербахче_(футбольный_клуб)')
    'Вильярреал' = @('world', 'Вильярреал_(футбольный_клуб)'); 'Атлетик' = @('world', 'Атлетик_Бильбао')
    'Селтик' = @('world', 'Селтик')
    # Клубы других континентов (Клубный чемпионат мира)
    'Интер Майами' = @('world', 'Интер_Майами'); 'Аль-Наср' = @('world', 'Аль-Наср_(футбольный_клуб,_Эр-Рияд)')
    'Аль-Хиляль' = @('world', 'Аль-Хиляль_(футбольный_клуб,_Эр-Рияд)'); 'Фламенго' = @('world', 'Фламенго')
    'Палмейрас' = @('world', 'Палмейрас'); 'Бока Хуниорс' = @('world', 'Бока_Хуниорс')
    'Ривер Плейт' = @('world', 'Ривер_Плейт')
    # Первая лига 2026/27 (вылет и стыки в серии РПЛ)
    'Ротор' = @('russia', 'Ротор_(футбольный_клуб)')
    'Урал' = @('russia', 'Урал_(футбольный_клуб)'); 'Арсенал Тула' = @('russia', 'Арсенал_(футбольный_клуб,_Тула)')
    'Торпедо' = @('russia', 'Торпедо_(футбольный_клуб,_Москва)'); 'Спартак Кс' = @('russia', 'Спартак_(футбольный_клуб,_Кострома)')
    'Енисей' = @('russia', 'Енисей_(футбольный_клуб)'); 'СКА-Хабаровск' = @('russia', 'СКА-Хабаровск')
    'Уфа' = @('russia', 'Уфа_(футбольный_клуб)'); 'Текстильщик' = @('russia', 'Текстильщик_(футбольный_клуб,_Иваново)')
    'Волга' = @('russia', 'Волга_(футбольный_клуб,_Ульяновск)'); 'Челябинск' = @('russia', 'Челябинск_(футбольный_клуб)')
    'КАМАЗ' = @('russia', 'КАМАЗ_(футбольный_клуб)'); 'Велес' = @('russia', 'Велес_(футбольный_клуб)')
    'Шинник' = @('russia', 'Шинник_(футбольный_клуб)'); 'Нефтехимик' = @('russia', 'Нефтехимик_(футбольный_клуб,_Нижнекамск)')
    'Ленинградец' = @('russia', 'Ленинградец_(футбольный_клуб)')
}

$posMap = @{ 'Вр' = 'goalkeepers'; 'Защ' = 'defenders'; 'ПЗ' = 'midfielders'; 'Нап' = 'forwards' }
$maxLine = @{ goalkeepers = 3; defenders = 9; midfielders = 9; forwards = 6 }

function Get-Api($params) {
    $q = ($params.GetEnumerator() | ForEach-Object { "$($_.Key)=$([uri]::EscapeDataString($_.Value))" }) -join '&'
    # Вежливо к Википедии: пауза между запросами, при «429 Too Many Requests» — ждём и повторяем
    for ($try = 1; ; $try++) {
        Start-Sleep -Milliseconds 1500
        try { return Invoke-RestMethod -UserAgent $ua -Uri "https://ru.wikipedia.org/w/api.php?$q&format=json&redirects=1&maxlag=5" }
        catch { if ($try -ge 6 -or $_.Exception.Message -notmatch '429|503') { throw }; Start-Sleep -Seconds (15 * $try) }
    }
}

# Имя из вики-разметки: [[Ссылка|Имя]], [[Имя]], {{нп|Фамилия, Имя|Имя Фамилия|...}}
function Get-PlayerName($raw) {
    $raw = $raw -replace '\s+', ' '
    if ($raw -match '^\[\[([^\]|]+)\|([^\]]+)\]\]') { return $Matches[2].Trim() }
    if ($raw -match '^\[\[([^\]]+)\]\]') { return ($Matches[1] -replace '\s*\(.*\)$', '').Trim() }
    if ($raw -match '^\{\{(?:нп\d?|iw|не переведено\s*\d?)\|([^|}]+)\|([^|}]*)') {
        if ($Matches[2].Trim()) { return $Matches[2].Trim() }
        $p = $Matches[1] -split ',\s*'; if ($p.Count -eq 2) { return "$($p[1]) $($p[0])".Trim() } else { return $Matches[1].Trim() }
    }
    return ($raw -replace '\[|\]|\{|\}', '').Trim()
}

function Get-Squad($title, $minDate = '2025-09-01') {
    $s = Get-Api @{ action = 'parse'; page = $title; prop = 'sections' }
    if (-not $s.parse) { throw "статья не найдена" }
    $sec = $s.parse.sections | Where-Object { $_.line -match '^(Текущий|Основной) состав$|^Состав$|^Состав команды$|^Игроки$' } | Select-Object -First 1
    if (-not $sec) { throw "нет раздела «Текущий состав»" }
    $w = Get-Api @{ action = 'parse'; page = $title; section = $sec.index; prop = 'wikitext' }
    $txt = $w.parse.wikitext.'*'
    $updated = if ($txt -match '\{\{обновлено\|(\d{4}-\d{2}-\d{2})') { $Matches[1] } else { '' }
    # Только основной состав: до первого «Конец состава» (дальше — аренда, дубль, академия)
    $endm = [regex]::Match($txt, '\{\{\s*[Кк]онец состава'); if ($endm.Success) { $txt = $txt.Substring(0, $endm.Index) }
    $players = @()
    foreach ($m in [regex]::Matches($txt, '\{\{[Ии]грок\s*\|[^|]*\|.*?\|\s*(Вр|Защ|ПЗ|Нап)[^|]*\|(\[\[[^\]]+\]\]|\{\{(?:нп\d?|iw|не переведено\s*\d?)\|[^}]+\}\}|[^|]+)\|[^\n]*?\|\s*(\d{4})\s*\}\}')) {
        $players += [pscustomobject]@{ line = $posMap[$m.Groups[1].Value]; name = (Get-PlayerName $m.Groups[2].Value); year = [int]$m.Groups[3].Value }
    }
    if ($players.Count -lt 14) { throw "найдено только $($players.Count) игроков" }
    # Данные старее наших (осень 2025) — не берём, чтобы не откатить состав назад
    if ($updated -and $updated -lt $minDate) { throw "состав в статье устарел (обновлён $updated)" }
    return @{ players = $players; updated = $updated }
}

# Старые составы (squads.js — это JSON после «const SQUADS =»)
$squadsPath = Join-Path $root 'js\data\squads.js'
$src = [IO.File]::ReadAllText($squadsPath, [Text.Encoding]::UTF8)
$start = $src.IndexOf('{', $src.IndexOf('const SQUADS'))
$json = $src.Substring($start, $src.LastIndexOf('}') - $start + 1)
$old = $json | ConvertFrom-Json

function Get-OldIndex($oldLine, $name) {
    if (-not $oldLine) { return -1 }
    $i = [array]::IndexOf([string[]]$oldLine, $name)
    if ($i -ge 0) { return $i }
    $last = ($name -split ' ')[-1]
    $hits = @(); for ($k = 0; $k -lt $oldLine.Count; $k++) { if ((($oldLine[$k] -split ' ')[-1]) -eq $last) { $hits += $k } }
    if ($hits.Count -eq 1) { return $hits[0] }
    return -1
}

$result = [ordered]@{ russia = [ordered]@{}; world = [ordered]@{} }
$births = [ordered]@{}
# Годы рождения из прошлых запусков сохраняются (обновляются только для заново загруженных клубов)
$bprev = Join-Path $root 'js\data\birthyears.js'
if (Test-Path $bprev) { foreach ($m in [regex]::Matches([IO.File]::ReadAllText($bprev, [Text.Encoding]::UTF8), '"([^"]+)":\s*(\d{4})')) { $births[$m.Groups[1].Value] = [int]$m.Groups[2].Value } }
$report = @()
# Звёзды (js\data\stars.js) всегда первые в своей линии — даже возрастные, как Месси
$stars = @([regex]::Matches([IO.File]::ReadAllText((Join-Path $root 'js\data\stars.js'), [Text.Encoding]::UTF8), "^\s*'([^']+)':\s*\d+", 'Multiline') | ForEach-Object { $_.Groups[1].Value })
foreach ($team in $clubs.Keys) {
    $type = $clubs[$team][0]; $title = $clubs[$team][1]
    $prev = $old.$type.$team
    if ($Only.Count -and $Only -notcontains $team) { if ($prev) { $result[$type][$team] = $prev }; continue }
    try {
        $sq = if ($prev) { Get-Squad $title } else { Get-Squad $title '2025-01-01' }  # новому клубу годится и чуть более старый состав
        $teamOut = [ordered]@{}
        foreach ($line in 'goalkeepers', 'defenders', 'midfielders', 'forwards') {
            $list = @($sq.players | Where-Object { $_.line -eq $line })
            $oldLine = if ($prev) { @($prev.$line) } else { @() }
            $scored = $list | ForEach-Object {
                $oi = Get-OldIndex $oldLine $_.name
                $age = $season - $_.year
                $score = if ($stars -contains $_.name) { -1 } elseif ($oi -ge 0) { $oi } elseif ($age -ge 22 -and $age -le 31) { 1.5 } elseif ($age -ge 20 -and $age -le 33) { 4.5 } else { 9 + (21 - [Math]::Min($age, 21)) }
                [pscustomobject]@{ name = $_.name; score = $score; year = $_.year }
            }
            $sorted = @($scored | Sort-Object score, @{ Expression = { [Math]::Abs(27 - ($season - $_.year)) } } | Select-Object -First $maxLine[$line])
            $teamOut[$line] = @($sorted | ForEach-Object { $_.name })
            $sorted | ForEach-Object { $births["$team|$($_.name)"] = $_.year }
        }
        $result[$type][$team] = $teamOut
        $kept = @($sq.players | Where-Object { (Get-OldIndex @($prev.($_.line)) $_.name) -ge 0 }).Count
        $report += "OK   $team — $($sq.players.Count) игроков (на $($sq.updated)), из прежних: $kept"
    } catch {
        if ($prev) { $result[$type][$team] = $prev }   # у нового клуба без состава — пропуск (в игре будут резервные имена)
        $report += "SKIP $team — $($_.Exception.Message) — оставлен прежний состав"
    }
    Start-Sleep -Milliseconds 300
}

# squads.js
$header = @"
// Составы команд, сезон 2026/27 (по разделу «Текущий состав» русской Википедии, осень 2026).
// Хранятся в .js (а не .json), чтобы игра открывалась двойным кликом без сервера.
// Формат: SQUADS[тип][команда] = { goalkeepers, defenders, midfielders, forwards }
// Внутри каждой линии — от сильнейшего к слабейшему: первые выходят в старт (1 вратарь, 4 защитника, 4 полузащитника, 2 нападающих).
// Обновить: tools\update-squads.ps1. Править удобнее во встроенном редакторе команд; проверить данные — tools/check-data.html.
const SQUADS =
"@
# Компактно, как раньше: команда — блок, линия — одна строка
function Q($s) { '"' + ($s -replace '\\', '\\' -replace '"', '\"') + '"' }
$parts = foreach ($type in 'russia', 'world') {
    $teams = foreach ($team in $result[$type].Keys) {
        $sq = $result[$type][$team]
        $ls = foreach ($line in 'goalkeepers', 'defenders', 'midfielders', 'forwards') {
            '      ' + (Q $line) + ': [' + ((@($sq.$line) | ForEach-Object { Q $_ }) -join ', ') + ']'
        }
        '    ' + (Q $team) + ": {`n" + ($ls -join ",`n") + "`n    }"
    }
    '  ' + (Q $type) + ": {`n" + ($teams -join ",`n") + "`n  }"
}
$body = "{`n" + ($parts -join ",`n") + "`n}"
[IO.File]::WriteAllText($squadsPath, $header + ' ' + $body + ";`n", (New-Object Text.UTF8Encoding $false))

# birthyears.js — годы рождения по «Клуб|Игрок» (поверх ages.js)
$bpath = Join-Path $root 'js\data\birthyears.js'
$lines = ($births.GetEnumerator() | ForEach-Object { '    ' + (ConvertTo-Json $_.Key) + ': ' + $_.Value }) -join ",`n"
$btxt = "// Годы рождения игроков из составов 2026/27 (Википедия). Ключ «Клуб|Игрок» проверяется первым (см. knownAge в ages.js).`nObject.assign(BIRTH_YEARS, {`n$lines`n});`n"
[IO.File]::WriteAllText($bpath, $btxt, (New-Object Text.UTF8Encoding $false))

$report
