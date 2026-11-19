// ===== УСТАНОВКА НА ТЕЛЕФОН (PWA) =====
// Регистрирует service worker (офлайн-режим) и показывает кнопку «Установить».
// Android / компьютер (Chrome, Edge): системное окно установки.
// iPhone / iPad (Safari): подсказка «Поделиться → На экран „Домой“».
// При открытии файла напрямую (file://) ничего не делает — там установка невозможна.

(function () {
    const canInstall = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const btn = document.getElementById('btn-install');
    let deferred = null;

    // На localhost (разработка) — только по ?sw=1, иначе кэш отдаёт вчерашние файлы во время правок
    const devHost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if ('serviceWorker' in navigator && canInstall && (!devHost || /[?&]sw=1/.test(location.search))) {
        window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* без офлайна — не страшно */ }));
    } else if ('serviceWorker' in navigator && devHost) {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister())).catch(() => {});
    }
    document.documentElement.classList.toggle('is-standalone', standalone); // запущено как приложение
    if (standalone || !btn || !canInstall) return;

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // Chrome / Edge / Android: браузер сам сообщает, что установка доступна
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferred = e;
        btn.style.display = '';
    });
    window.addEventListener('appinstalled', () => {
        btn.style.display = 'none';
        deferred = null;
    });
    // iPhone: событий нет — показываем кнопку с подсказкой
    if (isIOS) btn.style.display = '';

    btn.onclick = async () => {
        if (deferred) {
            deferred.prompt();
            await deferred.userChoice;
            deferred = null;
            btn.style.display = 'none';
            return;
        }
        showInstallHelp(isIOS);
    };

    function showInstallHelp(ios) {
        document.querySelector('.install-help')?.remove();
        const el = document.createElement('div');
        el.className = 'install-help';
        el.innerHTML = `<div class="install-box">
            <img src="icons/icon-192.png" alt="" width="72" height="72">
            <h3>Установить Football Sim</h3>
            ${ios
                ? `<ol><li>Нажмите <b>«Поделиться»</b> <span class="ih-ico">⬆️</span> внизу экрана Safari</li><li>Выберите <b>«На экран „Домой“»</b> <span class="ih-ico">➕</span></li><li>Нажмите <b>«Добавить»</b></li></ol>`
                : `<ol><li>Откройте меню браузера <span class="ih-ico">⋮</span></li><li>Выберите <b>«Установить приложение»</b> или <b>«Добавить на главный экран»</b></li></ol>`}
            <p class="muted">Игра откроется как отдельное приложение и будет работать без интернета.</p>
            <button type="button" class="btn-primary">Понятно</button>
        </div>`;
        el.onclick = e => { if (e.target === el || e.target.tagName === 'BUTTON') el.remove(); };
        document.body.appendChild(el);
    }
})();
