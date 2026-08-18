// Die Vorspann-Clips mit ihren GEMESSENEN Schnittpunkten.
//
// ⚠ Eigene Datei, kein Teil von make-reel.mjs: `plan.mjs` braucht die Namen
// fuer die Rotation, und make-reel.mjs ist ein Skript mit Nebenwirkungen — ein
// Import zum blossen Nachschlagen wuerde den ganzen Reel-Bau anwerfen. Dieselbe
// Ueberlegung wie bei plan.mjs gegenueber charge.mjs.
//
// ⚠ Hier steht eine TABELLE und kein Dateiname, weil jeder Schnittpunkt
// ausgemessen sein muss. Ein geratener Schnitt bei 2,4 s riss mitten in die
// Bewegung („der Uebergang ist zu schnell"). Wer einen Clip aufnehmen will,
// laesst erst `node scripts/reel/messe-vorspann.mjs <datei>` laufen — und sieht
// sich danach Einzelbilder am vorgeschlagenen Schnittpunkt an. Die Kurve allein
// entscheidet nicht: Bei `steine-zwei-haende` meldete sie ein Ruhefenster, in
// dem die Haende bloss reglos IM BILD standen.
//
// `ab` = Beginn in der Quelle, `sek` = Laenge des Ausschnitts. Beide Werte
// gehen in die Zeitrechnung des Reels ein (make-reel.mjs, VOR_VERSATZ).
//
// `blende` = der xfade-Uebergang ins Reel. Er SETZT DIE BEWEGUNG DES CLIPS
// FORT — waechst der Turm nach oben, schiebt sich das Brett von unten herein;
// wischen die Haende quer, wischt auch der Uebergang. Ein richtungsloser
// Uebergang nach einer gerichteten Bewegung laesst den Schnitt stehen, statt
// ihn zu tragen; das war der zweite Teil von „immer derselbe und abrupte
// Uebergang". Fehlt das Feld, gilt `fade`.
//
// ⚠ Harte `wipe`/`slide`-Uebergaenge bleiben draussen. Zwischen einem
// fotorealistischen Film und einer flachen App-Oberflaeche liest sich eine
// harte Kante als Praesentationsfolie. Nur weiche Verlaeufe kommen in Frage —
// und jeder wurde als Probe gebaut und angesehen, nicht am Reissbrett gewaehlt.
//
// Aufgenommen wird nur, was den Match-Cut traegt: formatfuellende Steine, die
// am Ende zur Ruhe kommen. Zwei Clips liegen deshalb bewusst DANEBEN statt
// darin — mit ihren Messwerten, damit niemand sie neu ausmessen muss:
//   steine-zwei-haende  Haende stehen im „Ruhefenster" reglos im Bild
//   mauer-bauen-b       { ab: 0, sek: 3.8 } — technisch in Ordnung, aber die
//                       Reihe laeuft fast von vorn ins Bild; die Steine fuellen
//                       nur etwa ein Drittel der Flaeche, der Rest ist Tisch.
export const VORSPAENNE = {
  // Ein Stein wird abgelegt, die Hand zieht sich zurueck, er steht allein.
  'steine-legen': { ab: 2.2, sek: 4.2, blende: 'fade' },
  // Eine Reihe kippt wie Dominosteine und kommt zur Ruhe. Der Schnitt beginnt
  // in der Stille VOR dem Sturz — ein Beitrag, der ruhig anfaengt und dann
  // kippt, haelt besser als einer, der mitten im Umfallen einsetzt.
  // ⚠ Hier stand zuerst `dissolve` — die Koernung sah nicht nach Effekt aus,
  // sondern nach kaputtem Video-Stream. Genau dafuer werden die Proben gebaut.
  'steine-kippen': { ab: 3.8, sek: 4.2, blende: 'smoothdown' },
  // Verdeckter Stein wird gedreht, ein roter Drache kommt zum Vorschein.
  // Das einzige Motiv, das eine Funktion der App zeigt: verdeckte Steine ab
  // Level 30. (Der Prompt bat um das Zeichen 中; der Drache passt besser, den
  // traegt die App im Icon und in den Mythen-Steinen.)
  'stein-drehen-a': { ab: 1.4, sek: 4.2, blende: 'circleopen' },
  // Dasselbe mit drei Steinen, der mittlere wird gedreht.
  // ⚠ Nur 4,0 s statt 4,2 — die Ruhe setzt frueher ein. Die Laengen duerfen
  // sich unterscheiden, die Zeitrechnung liest `sek` je Clip.
  'stein-drehen-b': { ab: 0, sek: 4.0, blende: 'circleopen' },
  // Haende mischen eine Flaeche aus Steinen. Der staerkste Match-Cut der
  // Sammlung — eine volle Flaeche Steine sieht dem Brett am aehnlichsten.
  'steine-mischen-a': { ab: 0.2, sek: 4.2, blende: 'smoothleft' },
  // Dasselbe, tiefe Kamera mit einer stehenden Reihe im Vordergrund.
  'steine-mischen-b': { ab: 1.0, sek: 4.2, blende: 'smoothright' },
  // Ein Turm waechst nach oben, dann ziehen sich die Haende zurueck. Der
  // Prompt bat um eine flache Mauer; der Stapel trifft die App genauer, deren
  // Bretter aus gestapelten Ebenen bestehen.
  'mauer-bauen-a': { ab: 0.4, sek: 4.2, blende: 'smoothup' },
};

export const VORSPANN_NAMEN = Object.keys(VORSPAENNE);
