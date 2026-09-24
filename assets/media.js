/*
 * Dirbtuvių medijos nustatymai.
 * Redaguokite tik šį failą: pagrindinis puslapis (index.html) ir QR kodo nukreipimas
 * (ikelk.html) viską pasiima iš čia.
 *
 * uploadUrl     Nuoroda, kur studentai kelia savo nuotraukas ir vaizdo įrašus, pvz.
 *               Google Drive aplankas su įkėlimo teise ar bendras Google Photos albumas.
 *               QR kodas visada veda į ikelk.html, o šis puslapis nukreipia čia, todėl
 *               pakeitus nuorodą QR kodo perkurti nereikia. Kol laukas tuščias,
 *               siūloma medžiagą atsiųsti el. paštu (contactEmail).
 *
 * videos        2025 m. dirbtuvių vaizdo įrašai. Kiekvienam įrašui nurodykite vieną iš:
 *                 youtube: YouTube nuoroda arba vaizdo įrašo ID
 *                 src:     failas iš assets/media/videos/ (MP4), poster – nebūtinas viršelis
 *                 url:     bet kokia kita nuoroda (Facebook, Instagram, Google Drive…)
 *
 * photos        Galerijos nuotraukos. Failus dėkite į assets/media/photos/
 *               (rekomenduojama iki 2000 px pločio, JPG arba WebP). alt – trumpas aprašymas
 *               ekrano skaitytuvams, caption – nebūtinas užrašas po nuotrauka.
 */
window.FPV_MEDIA = {
  uploadUrl: '',
  contactEmail: 'dominykas.petrulaitis@vilniustech.lt',

  videos: [
    // { youtube: 'https://youtu.be/XXXXXXXXXXX', title: 'Pirmieji skrydžiai', description: 'Spalio 21 d.' },
    // { src: 'assets/media/videos/lenktynes.mp4', poster: 'assets/media/videos/lenktynes.jpg', title: 'AGAI lenktynių finalas' },
    // { url: 'https://www.facebook.com/...', title: 'Dirbtuvių apžvalga' },
  ],

  photos: [
    // { src: 'assets/media/photos/surinkimas-01.jpg', alt: 'Studentai renka FPV droną', caption: 'Surinkimas' },
  ],
};
