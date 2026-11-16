/* Simulateur cumul emploi-retraite 2027 — calcul local, aucune donnée envoyée. */
(function () {
  "use strict";
  var SEUIL = 7000;            // décret n° 2026-1017, art. D. 161-2-8 CSS (valeur 2027)
  var TAUX_INTERMEDIAIRE = 0.5; // 50 % du dépassement entre l'âge légal et 67 ans
  var ABATT = { vente: 0.71, bic: 0.50, bnc: 0.34 };
  var MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

  function $(id) { return document.getElementById(id); }
  function eur(n) { return Math.round(n).toLocaleString("fr-FR") + " €"; }
  function num(id) { var v = parseFloat(String($(id).value).replace(",", ".")); return isFinite(v) && v > 0 ? v : 0; }
  function radio(name) { var e = document.querySelector('input[name="' + name + '"]:checked'); return e ? e.value : ""; }

  // Âge légal en mois, selon la date de naissance (après la suspension votée fin 2025).
  function ageLegalMois(y, m) {
    if (y < 1961 || (y === 1961 && m < 9)) return 62 * 12;
    if (y === 1961) return 62 * 12 + 3;
    if (y === 1962) return 62 * 12 + 6;
    if (y === 1963 || y === 1964 || (y === 1965 && m <= 3)) return 62 * 12 + 9;
    if (y === 1965) return 63 * 12;
    if (y === 1966) return 63 * 12 + 3;
    if (y === 1967) return 63 * 12 + 6;
    if (y === 1968) return 63 * 12 + 9;
    return 64 * 12;
  }
  function addMois(y, m, n) { var t = y * 12 + (m - 1) + n; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; }
  function fmtAge(mm) { var a = Math.floor(mm / 12), r = mm % 12; return a + " ans" + (r ? " et " + r + " mois" : ""); }
  function fmtDate(d) { return MOIS[d.m - 1] + " " + d.y; }

  function majNaissance() {
    var y = parseInt($("ny").value, 10), m = parseInt($("nm").value, 10), box = $("ageinfo");
    if (!y || !m || y < 1945 || y > 1985) { box.textContent = ""; return; }
    var al = ageLegalMois(y, m), dLegal = addMois(y, m, al), d67 = addMois(y, m, 67 * 12);
    box.textContent = "Votre âge légal : " + fmtAge(al) + ", atteint en " + fmtDate(dLegal) +
      ". Vos 67 ans : " + fmtDate(d67) + ".";
    // Présélection de la tranche au 1er janvier 2027
    var ref = 2027 * 12, tLegal = dLegal.y * 12 + dLegal.m - 1, t67 = d67.y * 12 + d67.m - 1;
    var v = ref >= t67 ? "C" : (ref >= tLegal ? "B" : "A");
    var el = document.querySelector('input[name="tranche"][value="' + v + '"]');
    if (el) el.checked = true;
  }

  function majStatut() {
    var s = radio("statut");
    $("bloc-micro").hidden = s !== "micro";
    $("lab-rev").textContent = s === "micro" ? "Chiffre d'affaires annuel prévu (€)" :
      s === "indep" ? "Revenu professionnel annuel soumis à cotisations (€)" : "Salaire brut annuel prévu (€)";
    $("hint-rev").textContent = s === "micro" ? "Le montant encaissé sur l'année, avant toute déduction." :
      s === "indep" ? "L'assiette qui sert au calcul de vos cotisations sociales." : "Le brut soumis à CSG, sur l'année civile.";
  }

  function calc(ev) {
    if (ev) ev.preventDefault();
    var out = $("result"), effet = radio("effet"), tranche = radio("tranche"), statut = radio("statut");
    var pensionM = num("pension"), rev = num("rev"), ij = num("ij"), derog = $("derog").checked;
    var html = "";

    if (effet === "avant") {
      out.innerHTML = '<div class="verdict ok"><span>Vous n\'êtes pas concerné par la réforme</span>' +
        '<span class="big">Anciennes règles conservées</span>' +
        "<p>Une première retraite de base qui a pris effet au plus tard le 1<sup>er</sup> décembre 2026 reste soumise aux règles antérieures " +
        "(cumul intégral ou plafonné selon votre situation), même si vous reprenez une activité plus tard. " +
        'Les conditions sont détaillées sur <a href="https://www.lassuranceretraite.fr" rel="noopener">lassuranceretraite.fr</a>.</p></div>';
      out.hidden = false; out.scrollIntoView({ behavior: "smooth" }); return;
    }
    if (!pensionM || !(rev + ij)) {
      out.innerHTML = '<div class="verdict mid"><p>Indiquez votre retraite mensuelle et le revenu prévu pour lancer le calcul.</p></div>';
      out.hidden = false; return;
    }

    var base = rev, noteMicro = "";
    if (statut === "micro" && $("abatt").checked) {
      var a = ABATT[$("activite").value] || 0;
      base = rev * (1 - a);
      noteMicro = "Hypothèse retenue : chiffre d'affaires après abattement forfaitaire de " + Math.round(a * 100) + " %. " +
        "Cette lecture n'est pas confirmée par les caisses ; la lecture la plus répandue du décret retient le chiffre d'affaires entier.";
    }
    var R = base + ij, pensionA = pensionM * 12, reduc = 0;
    if (derog || tranche === "C") reduc = 0;
    else if (tranche === "A") reduc = R;
    else reduc = Math.max(0, R - SEUIL) * TAUX_INTERMEDIAIRE;
    reduc = Math.min(reduc, pensionA);

    var tiers = pensionM / 3, retenue = Math.min(reduc / 12, tiers);
    var moisRecup = reduc > 0 ? Math.ceil(reduc / tiers) : 0;
    var garde = (rev + ij) - reduc, total = pensionA + garde;
    var cls = reduc === 0 ? "ok" : (reduc >= (rev + ij) * 0.75 ? "bad" : "mid");

    html += '<div class="verdict ' + cls + '"><span>Réduction estimée de votre retraite</span>' +
      '<span class="big">' + eur(reduc) + " sur l'année</span>";
    if (derog) html += "<p>Vous avez indiqué une activité dérogatoire : ses revenus ne sont en principe pas pris en compte. Faites confirmer ce point par votre caisse avant de vous engager.</p>";
    else if (tranche === "C") html += "<p>À partir de 67 ans, le cumul est libre, sans plafond, et vos cotisations ouvrent de nouveaux droits à retraite.</p>";
    else if (reduc === 0) html += "<p>Vos revenus pris en compte (" + eur(R) + ") restent sous le seuil de " + eur(SEUIL) + " par an : votre retraite n'est pas réduite.</p>";
    else if (tranche === "A") html += "<p>Avant l'âge légal, chaque euro gagné est retiré de la retraite. Sur ces " + eur(rev + ij) + " de revenus, il vous reste " + eur(garde) + " de gain réel, avant cotisations et impôt.</p>";
    else html += "<p>Vous dépassez le seuil de " + eur(R - SEUIL) + ". La moitié de ce dépassement est retirée de votre retraite. Sur " + eur(rev + ij) + " de revenus, votre gain réel est de " + eur(garde) + ", avant cotisations et impôt.</p>";
    html += "</div>";

    html += '<table class="kv">' +
      "<tr><td>Retraite brute sur l'année, sans activité</td><td>" + eur(pensionA) + "</td></tr>" +
      "<tr><td>Revenus pris en compte pour le calcul</td><td>" + eur(R) + "</td></tr>" +
      "<tr><td>Réduction de la retraite</td><td>− " + eur(reduc) + "</td></tr>" +
      "<tr><td>Retraite + revenus, après réduction (bruts)</td><td>" + eur(total) + "</td></tr>" +
      "</table>";

    if (reduc > 0) {
      html += "<h3>Comment la somme est récupérée</h3><p>La réduction est calculée sur l'année civile, puis retenue sur vos versements suivants par fractions égales sur douze mois, " +
        "sans pouvoir dépasser un tiers de chaque versement. Estimation : environ <strong>" + eur(retenue) + " retenus par mois</strong>" +
        (moisRecup > 12 ? ", sur une durée d'environ " + moisRecup + " mois car le plafond du tiers est atteint (le reliquat est reporté)." : " pendant douze mois.") + "</p>";
      if (tranche === "B") {
        html += '<div class="callout"><p><strong>Repère :</strong> pour ne rien perdre, vos revenus pris en compte doivent rester sous ' + eur(SEUIL) +
          " par an, soit environ " + eur(SEUIL / 12) + " par mois en moyenne. Au-delà, vous conservez 50 centimes par euro supplémentaire, avant cotisations et impôt.</p></div>";
      } else if (tranche === "A") {
        html += '<div class="callout"><p><strong>Repère :</strong> avant l\'âge légal, reprendre une activité n\'augmente pas votre revenu tant que la réduction n\'a pas absorbé toute la retraite. La situation change le mois qui suit votre âge légal.</p></div>';
      }
    }
    if (noteMicro) html += '<p class="small">' + noteMicro + "</p>";
    html += '<p class="small">Estimation indicative en montants bruts, pour une année civile complète dans la même tranche d\'âge. ' +
      "L'année où vous changez de tranche, les revenus sont proratisés : ce cas n'est pas simulé ici. Seule votre caisse de retraite peut établir le montant définitif. " +
      '<a href="methode-sources.html">Méthode et sources</a>.</p>';
    out.innerHTML = html; out.hidden = false; out.scrollIntoView({ behavior: "smooth" });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!$("sim")) return;
    $("sim").addEventListener("submit", calc);
    $("ny").addEventListener("input", majNaissance);
    $("nm").addEventListener("change", majNaissance);
    Array.prototype.forEach.call(document.querySelectorAll('input[name="statut"]'), function (r) { r.addEventListener("change", majStatut); });
    majStatut();
  });
})();
