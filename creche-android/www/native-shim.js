/* Petit Nid — adaptations Android (Capacitor).
   Sans effet dans un navigateur normal : tout est conditionné à Capacitor natif. */
(function () {
  var Cap = window.Capacitor;
  if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return;
  var P = Cap.Plugins;
  var DB_FILE = 'petit_nid_db.b64';

  /* ---------- Stockage fiable de la base (fichier interne, sans limite localStorage) ---------- */
  var pending = null, writing = false;
  function flush() {
    if (writing || pending === null) return Promise.resolve();
    writing = true;
    var data = pending; pending = null;
    return P.Filesystem.writeFile({ path: DB_FILE, data: data, directory: 'DATA', encoding: 'utf8' })
      .catch(function () {})
      .then(function () { writing = false; return flush(); });
  }
  window.__nativeStore = {
    get: function () {
      return P.Filesystem.readFile({ path: DB_FILE, directory: 'DATA', encoding: 'utf8' })
        .then(function (r) { return r && r.data ? r.data : null; })
        .catch(function () { return null; });
    },
    // les écritures sont sérialisées : seule la dernière version compte
    set: function (b64) { pending = b64; return flush(); }
  };

  /* ---------- Partage de fichiers (remplace les téléchargements) ---------- */
  function blobToB64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1] || ''); };
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }
  function shareB64(name, b64) {
    var safe = String(name || 'fichier').replace(/[\\/:*?"<>|]+/g, '_');
    return P.Filesystem.writeFile({ path: safe, data: b64, directory: 'CACHE' })
      .then(function (w) { return P.Share.share({ title: safe, files: [w.uri] }); })
      .catch(function (e) {
        if (e && /cancel/i.test(String(e.message || e))) return;
        alert('Partage impossible : ' + (e && e.message ? e.message : e));
      });
  }
  window.__shareText = function (name, text) {
    return shareB64(name, btoa(unescape(encodeURIComponent(text))));
  };

  // garder les Blob accessibles même après URL.revokeObjectURL()
  var blobs = {};
  var origCreate = URL.createObjectURL.bind(URL);
  var origRevoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = function (obj) {
    var u = origCreate(obj);
    if (obj instanceof Blob) blobs[u] = obj;
    return u;
  };
  URL.revokeObjectURL = function (u) {
    setTimeout(function () { delete blobs[u]; origRevoke(u); }, 60000);
  };

  function handleDownload(a) {
    var href = a.getAttribute('href') || '';
    var name = a.getAttribute('download') || 'fichier';
    if (blobs[href]) { blobToB64(blobs[href]).then(function (b) { shareB64(name, b); }); return true; }
    if (href.indexOf('data:') === 0) {
      var i = href.indexOf(',');
      var meta = href.slice(5, i), body = href.slice(i + 1);
      var b64 = /;base64/i.test(meta) ? body : btoa(unescape(encodeURIComponent(decodeURIComponent(body))));
      if (name.indexOf('.') < 0) {
        var ext = (meta.split(';')[0].split('/')[1] || '').replace('jpeg', 'jpg').replace('+xml', '');
        if (ext) name += '.' + ext;
      }
      shareB64(name, b64);
      return true;
    }
    return false;
  }
  function isExternal(href) { return /^(https?:|tel:|mailto:|sms:|geo:|whatsapp:)/i.test(href || ''); }
  function openExternal(url) { window.location.href = url; } // Capacitor l'ouvre dans l'appli adaptée

  var origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute('download') && handleDownload(this)) return;
    return origClick.call(this);
  };
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!a) return;
    if (a.hasAttribute('download')) {
      if (handleDownload(a)) ev.preventDefault();
    } else if (a.target === '_blank' && isExternal(a.getAttribute('href'))) {
      ev.preventDefault();
      openExternal(a.getAttribute('href'));
    }
  }, true);

  /* ---------- Fenêtres d'impression (reçus, feuilles de présence) ---------- */
  function showDoc(html) {
    var ov = document.createElement('div');
    ov.id = 'native-doc';
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top)';
    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:8px;padding:10px;border-bottom:1px solid #e8eaf1;background:#f5f6fa';
    var bShare = document.createElement('button');
    bShare.textContent = '📤 Partager / Imprimer';
    var bClose = document.createElement('button');
    bClose.textContent = '✕ Fermer';
    [bShare, bClose].forEach(function (b) {
      b.style.cssText = 'flex:1;padding:12px;border:none;border-radius:10px;font-size:1rem;font-weight:600;background:#6d8cff;color:#fff';
    });
    bClose.style.background = '#9aa0bd';
    var fr = document.createElement('iframe');
    fr.style.cssText = 'flex:1;border:none;width:100%';
    var m = /<title>([^<]*)<\/title>/i.exec(html);
    var name = ((m && m[1]) || 'document').trim() + '.html';
    function share() { window.__shareText(name, html); }
    bShare.onclick = share;
    bClose.onclick = function () { ov.remove(); };
    fr.onload = function () { try { fr.contentWindow.print = share; } catch (e) {} };
    bar.appendChild(bShare); bar.appendChild(bClose);
    ov.appendChild(bar); ov.appendChild(fr);
    document.body.appendChild(ov);
    fr.srcdoc = html;
  }

  var origOpen = window.open;
  window.open = function (url, target, features) {
    if (url && isExternal(url)) { openExternal(url); return null; }
    if (!url || url === 'about:blank') {
      var buf = [], shown = false;
      function done() { if (!shown) { shown = true; showDoc(buf.join('')); } }
      var fake = {
        closed: false,
        document: {
          open: function () { buf = []; },
          write: function () { buf.push.apply(buf, arguments); },
          writeln: function () { buf.push.apply(buf, arguments); buf.push('\n'); },
          close: done
        },
        print: function () {}, focus: function () {}, close: function () {}
      };
      setTimeout(done, 300); // au cas où document.close() n'est pas appelé
      return fake;
    }
    return origOpen.apply(window, arguments);
  };

  /* ---------- Bouton retour Android ---------- */
  if (P.App) {
    P.App.addListener('backButton', function () {
      var doc = document.getElementById('native-doc');
      if (doc) { doc.remove(); return; }
      var nav = document.getElementById('nav');
      if (nav && nav.classList.contains('open') && window.closeNav) { window.closeNav(); return; }
      var ov = document.getElementById('overlay');
      if (ov && ov.classList.contains('show') && window.closeSheet) { window.closeSheet(); return; }
      // `state` est un `let` global de l'appli : accessible par son nom, pas via window
      if (typeof state !== 'undefined' && state.tab && state.tab !== 'dashboard' && window.render) {
        state.tab = 'dashboard'; render(); window.scrollTo(0, 0); return;
      }
      P.App.exitApp();
    });
  }
})();
