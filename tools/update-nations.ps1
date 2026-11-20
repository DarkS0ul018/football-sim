# Обновляет составы сборных по разделу «Текущий состав» статей русской Википедии (последний вызов в сборную).
# Запуск:  powershell -ExecutionPolicy Bypass -File tools\update-nations.ps1
# Пишет:   js\data\nation-squads.js — поверх составов из js\data\nations.js (флаги, цвета, рейтинги там же)
#          и дополняет js\data\birthyears.js годами рождения («Сборная|Игрок»).
# Порядок в линии: игроки из прежнего списка сохраняют место; новые — по числу матчей за сборную.
param([string[]]$Only = @())

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$ua = 'FootballSimDataBot/1.0 (squad update script)'

# Сборная в игре → статья
$nations = [ordered]@{
    'Германия' = 'Сборная_Германии_по_футболу'; 'Франция' = 'Сборная_Франции_по_футболу'; 'Испания' = 'Сборная_Испании_по_футболу'
    'Англия' = 'Сборная_Англии_по_футболу'; 'Португалия' = 'Сборная_Португалии_по_футболу'; 'Нидерланды' = 'Сборная_Нидерландов_по_футболу'
    'Италия' = 'Сборная_Италии_по_футболу'; 'Бельгия' = 'Сборная_Бельгии_по_футболу'; 'Хорватия' = 'Сборная_Хорватии_по_футболу'
    'Швейцария' = 'Сборная_Швейцарии_по_футболу'; 'Дания' = 'Сборная_Дании_по_футболу'; 'Австрия' = 'Сборная_Австрии_по_футболу'
    'Турция' = 'Сборная_Турции_по_футболу'; 'Норвегия' = 'Сборная_Норвегии_по_футболу'; 'Сербия' = 'Сборная_Сербии_по_футболу'
    'Польша' = 'Сборная_Польши_по_футболу'; 'Чехия' = 'Сборная_Чехии_по_футболу'
    'Шотландия' = 'Сборная_Шотландии_по_футболу'; 'Венгрия' = 'Сборная_Венгрии_по_футболу'; 'Грузия' = 'Сборная_Грузии_по_футболу'
    'Словакия' = 'Сборная_Словакии_по_футболу'; 'Словения' = 'Сборная_Словении_по_футболу'; 'Румыния' = 'Сборная_Румынии_по_футболу'
    'Албания' = 'Сборная_Албании_по_футболу'; 'Аргентина' = 'Сборная_Аргентины_по_футболу'; 'Бразилия' = 'Сборная_Бразилии_по_футболу'
    'Уругвай' = 'Сборная_Уругвая_по_футболу'; 'Колумбия' = 'Сборная_Колумбии_по_футболу'; 'Мексика' = 'Сборная_Мексики_по_футболу'
    'США' = 'Сборная_США_по_футболу'; 'Эквадор' = 'Сборная_Эквадора_по_футболу'; 'Парагвай' = 'Сборная_Парагвая_по_футболу'
    'Канада' = 'Сборная_Канады_по_футболу'; 'Чили' = 'Сборная_Чили_по_футболу'; 'Венесуэла' = 'Сборная_Венесуэлы_по_футболу'
    'Перу' = 'Сборная_Перу_по_футболу'; 'Панама' = 'Сборная_Панамы_по_футболу'; 'Коста-Рика' = 'Сборная_Коста-Рики_по_футболу'
    'Ямайка' = 'Сборная_Ямайки_по_футболу'; 'Боливия' = 'Сборная_Боливии_по_футболу'; 'Марокко' = 'Сборная_Марокко_по_футболу'
    'Япония' = 'Сборная_Японии_по_футболу'; 'Сенегал' = 'Сборная_Сенегала_по_футболу'; "Кот-д'Ивуар" = ('Сборная_Кот-д' + [char]0x2019 + 'Ивуара_по_футболу')
    'Нигерия' = 'Сборная_Нигерии_по_футболу'; 'Египет' = 'Сборная_Египта_по_футболу'; 'Южная Корея' = 'Сборная_Республики_Корея_по_футболу'
    'Иран' = 'Сборная_Ирана_по_футболу'; 'Австралия' = 'Сборная_Австралии_по_футболу'
    'Швеция' = 'Сборная_Швеции_по_футболу'; 'Греция' = 'Сборная_Греции_по_футболу'; 'Уэльс' = 'Сборная_Уэльса_по_футболу'
    'Ирландия' = 'Сборная_Ирландии_по_футболу'; 'Босния и Герцеговина' = 'Сборная_Боснии_и_Герцеговины_по_футболу'
    'Северная Ирландия' = 'Сборная_Северной_Ирландии_по_футболу'; 'Финляндия' = 'Сборная_Финляндии_по_футболу'
    'Израиль' = 'Сборная_Израиля_по_футболу'; 'Исландия' = 'Сборная_Исландии_по_футболу'
    'Северная Македония' = 'Сборная_Северной_Македонии_по_футболу'; 'Черногория' = 'Сборная_Черногории_по_футболу'
    'Болгария' = 'Сборная_Болгарии_по_футболу'; 'Армения' = 'Сборная_Армении_по_футболу'; 'Казахстан' = 'Сборная_Казахстана_по_футболу'
    'Алжир' = 'Сборная_Алжира_по_футболу'; 'Камерун' = 'Сборная_Камеруна_по_футболу'; 'Тунис' = 'Сборная_Туниса_по_футболу'
    'Гана' = 'Сборная_Ганы_по_футболу'; 'Мали' = 'Сборная_Мали_по_футболу'; 'ЮАР' = 'Сборная_ЮАР_по_футболу'
    'Саудовская Аравия' = 'Сборная_Саудовской_Аравии_по_футболу'; 'Узбекистан' = 'Сборная_Узбекистана_по_футболу'
    'Катар' = 'Сборная_Катара_по_футболу'; 'Ирак' = 'Сборная_Ирака_по_футболу'; 'Иордания' = 'Сборная_Иордании_по_футболу'
    'Гондурас' = 'Сборная_Гондураса_по_футболу'; 'Новая Зеландия' = 'Сборная_Новой_Зеландии_по_футболу'
}

$posMap = @{ 'вр' = 'goalkeepers'; 'зщ' = 'defenders'; 'за' = 'defenders'; 'пз' = 'midfielders'; 'нп' = 'forwards'; 'на' = 'forwards' }
$maxLine = @{ goalkeepers = 3; defenders = 8; midfielders = 8; forwards = 6 }

function Get-Api($params) {
    $q = ($params.GetEnumerator() | ForEach-Object { "$($_.Key)=$([uri]::EscapeDataString($_.Value))" }) -join '&'
    for ($try = 1; ; $try++) {
        Start-Sleep -Milliseconds 1500
        try { return Invoke-RestMethod -UserAgent $ua -Uri "https://ru.wikipedia.org/w/api.php?$q&format=json&redirects=1&maxlag=5" }
        catch { if ($try -ge 6 -or $_.Exception.Message -notmatch '429|503') { throw }; Start-Sleep -Seconds (15 * $try) }
    }
}

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

function Get-NationSquad($title) {
    $s = Get-Api @{ action = 'parse'; page = $title; prop = 'sections' }
    if (-not $s.parse) { throw 'статья не найдена' }
    $sec = $s.parse.sections | Where-Object { $_.line -match '^(Текущий|Нынешний|Последний) состав|^Состав$|^Состав сборной' } | Select-Object -First 1
    if (-not $sec) { throw 'нет раздела «Текущий состав»' }
    $w = Get-Api @{ action = 'parse'; page = $title; section = $sec.index; prop = 'wikitext' }
    $txt = $w.parse.wikitext.'*'
    $players = @()
    foreach ($m in [regex]::Matches($txt, '\{\{тсс г игрок([^\n]*)')) {
        $row = $m.Groups[1].Value
        if ($row -notmatch 'позиция\s*=\s*([а-яё]{2})') { continue }
        $line = $posMap[$Matches[1].ToLower()]; if (-not $line) { continue }
        if ($row -notmatch 'имя\s*=\s*(\[\[[^\]]+\]\]|\{\{[^}]+\}\}|[^|]+)') { continue }
        $name = Get-PlayerName $Matches[1]
        $year = if ($row -match 'родился\|\d+\|\d+\|(\d{4})') { [int]$Matches[1] } else { 0 }
        $caps = if ($row -match 'игры\s*=\s*(\d+)') { [int]$Matches[1] } else { 0 }
        $players += [pscustomobject]@{ line = $line; name = $name; year = $year; caps = $caps }
    }
    # Второй вариант разметки: {{nat fs g player|pos=GK|name=...|age={{родился|..|..|1999}}|caps=12|...}}
    $enPos = @{ 'GK' = 'goalkeepers'; 'DF' = 'defenders'; 'MF' = 'midfielders'; 'FW' = 'forwards' }
    foreach ($m in [regex]::Matches($txt, '\{\{nat fs g player([^\n]*)')) {
        $row = $m.Groups[1].Value
        if ($row -notmatch 'pos\s*=\s*(GK|DF|MF|FW)') { continue }
        $line = $enPos[$Matches[1]]
        if ($row -notmatch 'name\s*=\s*(\[\[[^\]]+\]\]|\{\{[^}]+\}\}|[^|]+)') { continue }
        $name = Get-PlayerName $Matches[1]
        $year = if ($row -match '[Рр]одился\|\d+\|\d+\|(\d{4})') { [int]$Matches[1] } else { 0 }
        $caps = if ($row -match 'caps\s*=\s*(\d+)') { [int]$Matches[1] } else { 0 }
        $players += [pscustomobject]@{ line = $line; name = $name; year = $year; caps = $caps }
    }
    if ($players.Count -lt 16) { throw "найдено только $($players.Count) игроков" }
    $about = if ($txt -match '(\d{1,2} [а-я]+ 20\d\d)') { $Matches[1] } else { '' }
    return @{ players = $players; about = $about }
}

# Прежние составы из nations.js и уже обновлённых nation-squads.js
$natSrc = [IO.File]::ReadAllText((Join-Path $root 'js\data\nations.js'), [Text.Encoding]::UTF8)
function Get-OldSquad($name) {
    $i = $natSrc.IndexOf('"' + $name + '": {'); if ($i -lt 0) { return $null }
    $chunk = $natSrc.Substring($i, [Math]::Min(1500, $natSrc.Length - $i))
    $out = @{}
    foreach ($line in 'goalkeepers', 'defenders', 'midfielders', 'forwards') {
        if ($chunk -match ($line + ':\s*\[([^\]]*)\]')) { $out[$line] = @([regex]::Matches($Matches[1], "'((?:[^'\\]|\\.)*)'") | ForEach-Object { $_.Groups[1].Value -replace "\\'", "'" }) }
    }
    return $out
}

function Get-OldIndex($oldLine, $name) {
    if (-not $oldLine) { return -1 }
    $i = [array]::IndexOf([string[]]$oldLine, $name); if ($i -ge 0) { return $i }
    $last = ($name -split ' ')[-1]
    $hits = @(); for ($k = 0; $k -lt $oldLine.Count; $k++) { if ((($oldLine[$k] -split ' ')[-1]) -eq $last) { $hits += $k } }
    if ($hits.Count -eq 1) { return $hits[0] } else { return -1 }
}

$result = [ordered]@{}
$births = [ordered]@{}
$bpath = Join-Path $root 'js\data\birthyears.js'
$report = @()
# При выборочном обновлении (-Only) остальные составы берём из текущего nation-squads.js
if ($Only.Count) {
    $nsPath = Join-Path $root 'js\data\nation-squads.js'
    $nsSrc = [IO.File]::ReadAllText($nsPath, [Text.Encoding]::UTF8)
    $a = $nsSrc.IndexOf('{', $nsSrc.IndexOf('const NATION_SQUADS')); $b = $nsSrc.IndexOf('};', $a)
    $nsJson = ($nsSrc.Substring($a, $b - $a + 1)) -replace '(?m)^(\s+)(goalkeepers|defenders|midfielders|forwards):', '$1"$2":'
    $nsOld = $nsJson | ConvertFrom-Json
    foreach ($p in $nsOld.PSObject.Properties) {
        if ($Only -contains $p.Name) { continue }
        $o = [ordered]@{}; foreach ($line in 'goalkeepers', 'defenders', 'midfielders', 'forwards') { $o[$line] = @($p.Value.$line) }
        $result[$p.Name] = $o
    }
}
# Звёзды (js\data\stars.js) — первые в своей линии
$stars = @([regex]::Matches([IO.File]::ReadAllText((Join-Path $root 'js\data\stars.js'), [Text.Encoding]::UTF8), "^\s*'([^']+)':\s*\d+", 'Multiline') | ForEach-Object { $_.Groups[1].Value })
foreach ($nation in $nations.Keys) {
    if ($Only.Count -and $Only -notcontains $nation) { continue }
    $old = Get-OldSquad $nation
    try {
        $sq = Get-NationSquad $nations[$nation]
        $out = [ordered]@{}
        foreach ($line in 'goalkeepers', 'defenders', 'midfielders', 'forwards') {
            $list = @($sq.players | Where-Object { $_.line -eq $line })
            $oldLine = if ($old) { @($old[$line]) } else { @() }
            $sorted = @($list | ForEach-Object {
                $oi = Get-OldIndex $oldLine $_.name
                # прежние — на своих местах; новые — между ними по опыту (чем больше матчей, тем выше)
                $score = if ($stars -contains $_.name) { -1 } elseif ($oi -ge 0) { $oi } else { 6 - [Math]::Min(5.5, $_.caps / 12) }
                [pscustomobject]@{ name = $_.name; score = $score; year = $_.year; caps = $_.caps }
            } | Sort-Object score, @{ Expression = { -$_.caps } } | Select-Object -First $maxLine[$line])
            $out[$line] = @($sorted | ForEach-Object { $_.name })
            $sorted | Where-Object { $_.year } | ForEach-Object { $births["$nation|$($_.name)"] = $_.year }
        }
        foreach ($line in 'goalkeepers', 'defenders', 'midfielders', 'forwards') { if ($out[$line].Count -lt 1) { throw "нет игроков в линии $line" } }
        $result[$nation] = $out
        $report += "OK   $nation — $($sq.players.Count) игроков ($($sq.about))"
    } catch {
        $report += "SKIP $nation — $($_.Exception.Message) — оставлен прежний состав"
    }
}

function Q($s) { '"' + ($s -replace '\\', '\\' -replace '"', '\"') + '"' }
$teams = foreach ($n in $result.Keys) {
    $ls = foreach ($line in 'goalkeepers', 'defenders', 'midfielders', 'forwards') { '        ' + $line + ': [' + ((@($result[$n][$line]) | ForEach-Object { Q $_ }) -join ', ') + ']' }
    '    ' + (Q $n) + ": {`n" + ($ls -join ",`n") + "`n    }"
}
$txt = @"
// Составы сборных, сезон 2026/27 — последние вызовы (раздел «Текущий состав» русской Википедии, осень 2026).
// Накладываются поверх составов из nations.js; флаги, цвета формы и рейтинги — там же.
// Обновить: tools\update-nations.ps1
const NATION_SQUADS = {
$($teams -join ",`n")
};
Object.entries(NATION_SQUADS).forEach(([name, squad]) => { if (NATIONS[name]) NATIONS[name].squad = squad; });

"@
[IO.File]::WriteAllText((Join-Path $root 'js\data\nation-squads.js'), $txt, (New-Object Text.UTF8Encoding $false))

# Годы рождения — дописываем в birthyears.js (клубные записи сохраняются)
$all = [ordered]@{}
if (Test-Path $bpath) { foreach ($m in [regex]::Matches([IO.File]::ReadAllText($bpath, [Text.Encoding]::UTF8), '"([^"]+)":\s*(\d{4})')) { $all[$m.Groups[1].Value] = [int]$m.Groups[2].Value } }
foreach ($k in $births.Keys) { $all[$k] = $births[$k] }
$lines = ($all.GetEnumerator() | ForEach-Object { '    ' + (Q $_.Key) + ': ' + $_.Value }) -join ",`n"
[IO.File]::WriteAllText($bpath, "// Годы рождения игроков из составов 2026/27 (Википедия). Ключ «Команда|Игрок» проверяется первым (см. knownAge в ages.js).`nObject.assign(BIRTH_YEARS, {`n$lines`n});`n", (New-Object Text.UTF8Encoding $false))

$report
