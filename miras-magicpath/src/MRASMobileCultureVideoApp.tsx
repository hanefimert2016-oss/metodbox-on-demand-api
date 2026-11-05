import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Home, Compass, Bookmark, UserRound, Plus, Search, Globe2, ChevronDown, ChevronRight, Play, MapPin, Clock, Heart, Share2, X, ArrowLeft, ArrowRight, Sparkles, Clapperboard, MessageCircle, Send, Upload, Check, ExternalLink, Info, Star } from 'lucide-react';
import './MRASMobileCultureVideoApp.css';
import catalog from '../../android/app/src/main/assets/catalog.json';
type Lang = 'tr' | 'en' | 'de' | 'fr' | 'es' | 'ar';
type Cat = 'all' | 'places' | 'food' | 'history' | 'art' | 'nature';
type Tab = 'home' | 'explore' | 'saved' | 'profile';
type Video = {
  id: number;
  tr: string;
  en: string;
  place: string;
  cat: Exclude<Cat, 'all'>;
  author: string;
  time: string;
  views: string;
  image: string;
  src?: string;
  link: string;
  credit: string;
  doc?: boolean;
  backendId?: string;
  shareUrl?: string;
  description?: string;
  license?: string;
};
const image = (name: string) => 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(name) + '?width=1000';
type CatalogVideo = {
  id: string; title: {tr?: string; en?: string}; description?: {tr?: string;en?: string};
  category?: string; creator?: string; license?: string; license_url?: string;
  poster_url?: string; cover?: string; video_url?: string; source_url?: string;
  share_url?: string; duration?: number; place?: string; type?: string;
};
const durationLabel = (input?: number) => {
  const s = Math.max(0, Math.floor(input || 0));
  if(!s) return '—';
  const two = (n:number)=>String(n).padStart(2,'0');
  return s >= 3600 ? Math.floor(s/3600)+':'+two(Math.floor(s%3600/60))+':'+two(s%60)
                   : Math.floor(s/60)+':'+two(s%60);
};
const translateCategory = (c?: string): Exclude<Cat,'all'> =>
  c==='arts' ? 'art' : c==='daily' ? 'places' :
  (['places','food','history','nature','art'].includes(c||'') ? c as Exclude<Cat,'all'> : 'places');
const adaptVideo = (v: CatalogVideo, index: number, prefix=1): Video => ({
  id: prefix + index,
  backendId: v.id,
  tr: v.title?.tr || v.title?.en || 'Türkiye',
  en: v.title?.en || v.title?.tr || 'Türkiye',
  place: v.place || 'Türkiye',
  cat: translateCategory(v.category),
  author: v.creator || 'MİRAS',
  time: durationLabel(v.duration),
  views: '',
  image: (v.poster_url || v.cover || 'img/poster-unavailable.svg').replace(/^\/img\//,'img/'),
  src: v.video_url || '',
  link: v.source_url || '',
  shareUrl: v.share_url,
  credit: [v.creator, v.license].filter(Boolean).join(' · '),
  license: v.license || '',
  description: v.description?.tr || v.description?.en || '',
  doc: (v.duration||0)>=300
});
const videos: Video[] = (catalog as CatalogVideo[]).map((v,i) => adaptVideo(v,i));
const categoryItems: {
  id: Cat;
  tr: string;
  en: string;
}[] = [{
  id: 'all',
  tr: 'Tümü',
  en: 'All'
}, {
  id: 'places',
  tr: 'Şehirler',
  en: 'Places'
}, {
  id: 'food',
  tr: 'Lezzet',
  en: 'Food'
}, {
  id: 'history',
  tr: 'Tarih',
  en: 'History'
}, {
  id: 'art',
  tr: 'Sanat',
  en: 'Arts'
}, {
  id: 'nature',
  tr: 'Doğa',
  en: 'Nature'
}];
const strings = {
  tr: {
    one: 'Bir ülke. Binlerce hikâye.',
    desc: 'Türkiye’yi hikâyelerle keşfet.',
    welcome: 'DÜNYAYA AÇILAN TÜRKİYE',
    featured: 'ÖNE ÇIKAN HİKÂYE',
    watch: 'İzlemeye başla',
    selected: 'Senin için seçtik',
    all: 'Tümünü gör',
    long: 'Biraz daha kal',
    longSub: 'Uzun uzun izlemek isteyenlere',
    picks: 'EDİTÖRÜN SEÇTİKLERİ',
    day: 'GÜNÜN SEÇKİSİ',
    home: 'Ana sayfa',
    explore: 'Keşfet',
    saved: 'Kaydedilenler',
    upload: 'Yükle',
    profile: 'Profil',
    search: 'Hikâye, şehir veya kültür ara…',
    searchTitle: 'Ne keşfetmek istersin?',
    saveTitle: 'Senin koleksiyonun',
    saveDesc: 'Beğendiğin hikâyeleri burada biriktir.',
    exploreTitle: 'Türkiye’yi keşfet',
    exploreDesc: 'Kültürümüzü şehir şehir, hikâye hikâye gez.',
    profileTitle: 'Kendi MİRAS’ını yarat',
    profileDesc: 'Kültür hikâyelerini kaydet, takip et ve paylaş.',
    uploadTitle: 'Yeni hikâye ekle',
    uploadDesc: 'Kendi hikâyeni paylaşmak için video bilgilerini hazırla.',
    title: 'Video başlığı',
    link: 'Video bağlantısı',
    create: 'Önizleme oluştur',
    demo: 'Tasarım önizlemesidir; sunucuya video yüklenmez.',
    unavailable: 'Bu bir örnek katalog kartıdır. Oynatılacak video henüz bağlanmadı.',
    source: 'Kaynağı görüntüle',
    comments: 'Yorumlar',
    comment: 'Yorum yaz…',
    like: 'Beğen',
    share: 'Paylaş',
    follow: 'Takip et',
    following: 'Takiptesin',
    copied: 'Bağlantı kopyalandı',
    created: 'Örnek kart oluşturuldu',
    empty: 'Sonuç bulunamadı',
    notice: 'MİRAS tasarım önizlemesi · Örnek katalog'
  },
  en: {
    one: 'One country. A thousand stories.',
    desc: 'Experience Türkiye through stories.',
    welcome: 'TÜRKİYE OPEN TO THE WORLD',
    featured: 'FEATURED STORY',
    watch: 'Start watching',
    selected: 'Curated for you',
    all: 'View all',
    long: 'Stay a little longer',
    longSub: 'Stories worth slowing down for',
    picks: 'EDITOR’S PICKS',
    day: 'TODAY’S PICK',
    home: 'Home',
    explore: 'Explore',
    saved: 'Saved',
    upload: 'Upload',
    profile: 'Profile',
    search: 'Search stories, cities or culture…',
    searchTitle: 'What would you like to discover?',
    saveTitle: 'Your collection',
    saveDesc: 'Your favourite stories will live here.',
    exploreTitle: 'Discover Türkiye',
    exploreDesc: 'Explore our culture one city at a time.',
    profileTitle: 'Create your MİRAS',
    profileDesc: 'Save, follow and share cultural stories.',
    uploadTitle: 'Add a new story',
    uploadDesc: 'Prepare a title and link to share a video.',
    title: 'Video title',
    link: 'Video URL',
    create: 'Create preview',
    demo: 'Design prototype; no video is uploaded to a server.',
    unavailable: 'This is a sample catalog card. Its real video has not been linked yet.',
    source: 'View source',
    comments: 'Comments',
    comment: 'Write a comment…',
    like: 'Like',
    share: 'Share',
    follow: 'Follow',
    following: 'Following',
    copied: 'Link copied',
    created: 'Sample card created',
    empty: 'No results found',
    notice: 'MİRAS design preview · Sample catalogue'
  }
};
const languages: {
  code: Lang;
  flag: string;
  name: string;
}[] = [{
  code: 'tr',
  flag: '🇹🇷',
  name: 'Türkçe'
}, {
  code: 'en',
  flag: '🇬🇧',
  name: 'English'
}, {
  code: 'de',
  flag: '🇩🇪',
  name: 'Deutsch'
}, {
  code: 'fr',
  flag: '🇫🇷',
  name: 'Français'
}, {
  code: 'es',
  flag: '🇪🇸',
  name: 'Español'
}, {
  code: 'ar',
  flag: '🇸🇦',
  name: 'العربية'
}];
const translations = {
  "de": {
    "one": "Ein Land. Tausend Geschichten.",
    "desc": "Entdecke die Türkei durch ihre Geschichten.",
    "welcome": "TÜRKEI FÜR DIE WELT",
    "featured": "IM FOKUS",
    "watch": "Jetzt ansehen",
    "selected": "Für dich ausgewählt",
    "all": "Alle ansehen",
    "long": "Bleib noch etwas",
    "longSub": "Geschichten zum Eintauchen",
    "picks": "EMPFEHLUNGEN DER REDAKTION",
    "day": "AUSWAHL DES TAGES",
    "home": "Start",
    "explore": "Entdecken",
    "saved": "Gespeichert",
    "upload": "Hochladen",
    "profile": "Profil",
    "search": "Geschichten, Städte und Kultur suchen…",
    "searchTitle": "Was möchtest du entdecken?",
    "saveTitle": "Deine Sammlung",
    "saveDesc": "Sammle hier deine Lieblingsgeschichten.",
    "exploreTitle": "Entdecke die Türkei",
    "exploreDesc": "Erkunde unsere Kultur Stadt für Stadt.",
    "profileTitle": "Erstelle dein MİRAS",
    "profileDesc": "Speichere, folge und teile kulturelle Geschichten.",
    "uploadTitle": "Neue Geschichte hinzufügen",
    "uploadDesc": "Bereite den Titel und den Videolink vor.",
    "title": "Videotitel",
    "link": "Videolink",
    "create": "Vorschau erstellen",
    "demo": "Designvorschau: Es wird kein Video hochgeladen.",
    "unavailable": "Beispielkarte. Noch kein Video verknüpft.",
    "source": "Quelle ansehen",
    "comments": "Kommentare",
    "comment": "Kommentar schreiben…",
    "like": "Gefällt mir",
    "share": "Teilen",
    "follow": "Folgen",
    "following": "Du folgst",
    "copied": "Link kopiert",
    "created": "Beispielkarte erstellt",
    "empty": "Keine Ergebnisse",
    "notice": "MİRAS Designvorschau · Beispielkatalog"
  },
  "fr": {
    "one": "Un pays. Mille histoires.",
    "desc": "Découvrez la Türkiye à travers ses histoires.",
    "welcome": "LA TÜRKİYE OUVERTE AU MONDE",
    "featured": "À LA UNE",
    "watch": "Regarder",
    "selected": "Choisis pour vous",
    "all": "Tout voir",
    "long": "Restez un peu",
    "longSub": "Des histoires à savourer",
    "picks": "LE CHOIX DE LA RÉDACTION",
    "day": "SÉLECTION DU JOUR",
    "home": "Accueil",
    "explore": "Explorer",
    "saved": "Enregistrés",
    "upload": "Publier",
    "profile": "Profil",
    "search": "Chercher histoires, villes et culture…",
    "searchTitle": "Que souhaitez-vous découvrir ?",
    "saveTitle": "Votre collection",
    "saveDesc": "Retrouvez vos histoires préférées ici.",
    "exploreTitle": "Découvrez la Türkiye",
    "exploreDesc": "Explorez notre culture de ville en ville.",
    "profileTitle": "Créez votre MİRAS",
    "profileDesc": "Enregistrez, suivez et partagez des histoires.",
    "uploadTitle": "Ajouter une histoire",
    "uploadDesc": "Préparez le titre et le lien de votre vidéo.",
    "title": "Titre de la vidéo",
    "link": "Lien de la vidéo",
    "create": "Créer un aperçu",
    "demo": "Aperçu : aucune vidéo n’est envoyée.",
    "unavailable": "Fiche d’exemple sans vidéo associée.",
    "source": "Voir la source",
    "comments": "Commentaires",
    "comment": "Écrire un commentaire…",
    "like": "J’aime",
    "share": "Partager",
    "follow": "Suivre",
    "following": "Abonné",
    "copied": "Lien copié",
    "created": "Fiche créée",
    "empty": "Aucun résultat",
    "notice": "Aperçu MİRAS · Catalogue d’exemple"
  },
  "es": {
    "one": "Un país. Mil historias.",
    "desc": "Descubre Türkiye a través de sus historias.",
    "welcome": "TÜRKİYE PARA TODO EL MUNDO",
    "featured": "HISTORIA DESTACADA",
    "watch": "Ver ahora",
    "selected": "Elegido para ti",
    "all": "Ver todo",
    "long": "Quédate un poco más",
    "longSub": "Historias para disfrutar con calma",
    "picks": "SELECCIÓN EDITORIAL",
    "day": "SELECCIÓN DEL DÍA",
    "home": "Inicio",
    "explore": "Explorar",
    "saved": "Guardados",
    "upload": "Subir",
    "profile": "Perfil",
    "search": "Buscar historias, ciudades o cultura…",
    "searchTitle": "¿Qué quieres descubrir?",
    "saveTitle": "Tu colección",
    "saveDesc": "Guarda aquí tus historias favoritas.",
    "exploreTitle": "Descubre Türkiye",
    "exploreDesc": "Explora nuestra cultura ciudad por ciudad.",
    "profileTitle": "Crea tu propio MİRAS",
    "profileDesc": "Guarda, sigue y comparte historias culturales.",
    "uploadTitle": "Añadir una historia",
    "uploadDesc": "Prepara el título y enlace de tu vídeo.",
    "title": "Título del vídeo",
    "link": "Enlace del vídeo",
    "create": "Crear vista previa",
    "demo": "Vista previa: no se sube ningún vídeo.",
    "unavailable": "Tarjeta de ejemplo sin vídeo asociado.",
    "source": "Ver fuente",
    "comments": "Comentarios",
    "comment": "Escribe un comentario…",
    "like": "Me gusta",
    "share": "Compartir",
    "follow": "Seguir",
    "following": "Siguiendo",
    "copied": "Enlace copiado",
    "created": "Tarjeta creada",
    "empty": "No hay resultados",
    "notice": "Vista previa de MİRAS · Catálogo de ejemplo"
  },
  "ar": {
    "one": "بلد واحد. آلاف الحكايات.",
    "desc": "اكتشف تركيا من خلال الحكايات.",
    "welcome": "تركيا إلى العالم",
    "featured": "قصة مميزة",
    "watch": "شاهد الآن",
    "selected": "اخترنا لك",
    "all": "عرض الكل",
    "long": "ابقَ قليلاً",
    "longSub": "حكايات تستحق التأمل",
    "picks": "اختيارات المحررين",
    "day": "اختيار اليوم",
    "home": "الرئيسية",
    "explore": "استكشف",
    "saved": "المحفوظات",
    "upload": "رفع",
    "profile": "الملف الشخصي",
    "search": "ابحث عن قصة أو مدينة أو ثقافة…",
    "searchTitle": "ماذا تريد أن تكتشف؟",
    "saveTitle": "مجموعتك",
    "saveDesc": "اجمع حكاياتك المفضلة هنا.",
    "exploreTitle": "اكتشف تركيا",
    "exploreDesc": "استكشف ثقافتنا مدينة بعد مدينة.",
    "profileTitle": "أنشئ ميراثك",
    "profileDesc": "احفظ الحكايات الثقافية وتابعها وشاركها.",
    "uploadTitle": "أضف حكاية جديدة",
    "uploadDesc": "أدخل عنوان الفيديو ورابطه.",
    "title": "عنوان الفيديو",
    "link": "رابط الفيديو",
    "create": "إنشاء معاينة",
    "demo": "معاينة فقط؛ لن يتم رفع أي فيديو.",
    "unavailable": "بطاقة نموذجية دون فيديو مرتبط.",
    "source": "عرض المصدر",
    "comments": "التعليقات",
    "comment": "اكتب تعليقًا…",
    "like": "إعجاب",
    "share": "مشاركة",
    "follow": "متابعة",
    "following": "تتابع",
    "copied": "تم نسخ الرابط",
    "created": "تم إنشاء البطاقة",
    "empty": "لا توجد نتائج",
    "notice": "معاينة MİRAS · كتالوج تجريبي"
  }
};
const allStrings = {
  tr: strings.tr,
  en: strings.en,
  de: {
    ...strings.en,
    ...translations.de
  },
  fr: {
    ...strings.en,
    ...translations.fr
  },
  es: {
    ...strings.en,
    ...translations.es
  },
  ar: {
    ...strings.en,
    ...translations.ar
  }
};
const categoryNames: Record<Lang, string[]> = {
  "tr": ["Tümü", "Şehirler", "Lezzet", "Tarih", "Sanat", "Doğa"],
  "en": ["All", "Places", "Food", "History", "Arts", "Nature"],
  "de": ["Alle", "Orte", "Kulinarik", "Geschichte", "Kunst", "Natur"],
  "fr": ["Tout", "Lieux", "Cuisine", "Histoire", "Arts", "Nature"],
  "es": ["Todo", "Lugares", "Gastronomía", "Historia", "Arte", "Naturaleza"],
  "ar": ["الكل", "المدن", "المأكولات", "التاريخ", "الفنون", "الطبيعة"]
};
const translatedVideoTitles: Record<Exclude<Lang, 'tr' | 'en'>, string[]> = {
  "de": ["Kappadokien: Ein Tor zum Himmel", "Der Bosporus: Zwei Kontinente, eine Geschichte", "Türkischer Tee: Mehr als ein Getränk", "Ein Tag im Großen Basar", "Göreme vor Sonnenaufgang", "Sultanahmets zeitlose Schönheit"],
  "fr": ["Cappadoce : une porte vers le ciel", "Le Bosphore : deux continents, une histoire", "Thé turc : bien plus qu’une tasse", "Une journée au Grand Bazar", "Göreme avant le lever du soleil", "La beauté intemporelle de Sultanahmet"],
  "es": ["Capadocia: una puerta al cielo", "El Bósforo: dos continentes, una historia", "Té turco: mucho más que una taza", "Un día en el Gran Bazar", "Göreme antes del amanecer", "La belleza eterna de Sultanahmet"],
  "ar": ["كابادوكيا: بوابة إلى السماء", "البوسفور: قارتان وحكاية واحدة", "الشاي التركي: أكثر من مجرد كوب", "يوم في البازار الكبير", "غوريمه قبل شروق الشمس", "جمال السلطان أحمد الخالد"]
};
const languageNames: Record<Lang, string> = {
  tr: 'Dil seç',
  en: 'Choose language',
  de: 'Sprache wählen',
  fr: 'Choisir la langue',
  es: 'Elegir idioma',
  ar: 'اختر اللغة'
};
const statLabels: Record<Lang, [string, string, string]> = {
  tr: ['Hikâye', 'Kayıt', 'Beğeni'],
  en: ['Stories', 'Saved', 'Likes'],
  de: ['Geschichten', 'Gespeichert', 'Likes'],
  fr: ['Histoires', 'Enregistrés', 'J’aime'],
  es: ['Historias', 'Guardados', 'Me gusta'],
  ar: ['الحكايات', 'المحفوظات', 'الإعجابات']
};
const heritageTexts: Record<Lang, string> = {
  tr: 'Türkiye’nin kültürel mirasını bir hikâye ile tanı.',
  en: 'Discover a piece of Türkiye’s rich cultural heritage through stories.',
  de: 'Entdecke das reiche kulturelle Erbe der Türkei.',
  fr: 'Découvrez la richesse culturelle de la Türkiye.',
  es: 'Descubre el patrimonio cultural de Türkiye.',
  ar: 'اكتشف التراث الثقافي الغني لتركيا.'
};
export const MRASMobileCultureVideoApp = () => {
  const [lang, setLang] = useState<Lang>(() => {
      try {
        const previous = window.localStorage.getItem('miras-language');
        return languages.some(x => x.code === previous) ? previous as Lang : 'tr';
      } catch {
        return 'tr';
      }
    }),
    [tab, setTab] = useState<Tab>('home'),
    [cat, setCat] = useState<Cat>('all'),
    [query, setQuery] = useState(''),
    [search, setSearch] = useState(false),
    [active, setActive] = useState<Video | null>(null),
    [saved, setSaved] = useState<number[]>(() => {
      try { return JSON.parse(localStorage.getItem('miras_saved_magicpath')||'[]'); }
      catch { return []; }
    }),
    [liked, setLiked] = useState<number[]>([]),
    [follows, setFollows] = useState<string[]>([]),
    [upload, setUpload] = useState(false),
    [draftTitle, setDraftTitle] = useState(''),
    [draftLink, setDraftLink] = useState(''),
    [mine, setMine] = useState<Video | null>(null),
    [comment, setComment] = useState(''),
    [comments, setComments] = useState<Record<number, string[]>>({}),
    [toast, setToast] = useState('');
  const [languageOpen, setLanguageOpen] = useState(false);

  const [remoteVideos, setRemoteVideos] = useState<Video[]>([]);
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<{username:string;saved?:string[]} | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authRegister, setAuthRegister] = useState(false);
  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authDisplay, setAuthDisplay] = useState('');
  const [uploadFile, setUploadFile] = useState<File|null>(null);
  const [busy, setBusy] = useState(false);
  const [social, setSocial] = useState<Record<number,{likes:number;liked:boolean;comments:Array<{username:string;text:string}>}>>({});
  const apiBase = String((window as Window & {MIRAS_API_BASE_URL?:string}).MIRAS_API_BASE_URL ||
      (location.hostname === 'appassets.androidplatform.net' ? '' : location.origin)).replace(/\/$/,'');
  const token = () => localStorage.getItem('miras_v3_token') || '';
  const request = async (path:string, method='GET', data?:object|FormData):Promise<any> => {
    if(!apiBase) throw Error('Topluluk sunucusu henüz etkin değil / Community service is not available');
    const h:Record<string,string>={};
    if(token()) h.Authorization='Bearer '+token();
    if(data && !(data instanceof FormData)) h['content-type']='application/json';
    const res=await fetch(apiBase+path,{method,headers:h,body:data instanceof FormData ? data : data ? JSON.stringify(data) : undefined});
    let value:any={};try{value=await res.json()}catch{}
    if(!res.ok) throw Error(value.error||('HTTP '+res.status));
    return value;
  };
  useEffect(()=>{
    let cancelled=false;
    if(!apiBase) return;
    (async()=>{
      try {
        const conf=await request('/api/config');
        if(cancelled || !conf.community_enabled) return;
        setReady(true);
        const feed=await request('/api/videos');
        if(!cancelled) {
          const community=(feed.videos||[]).filter((v:CatalogVideo)=>v.type==='upload');
          setRemoteVideos(community.map((v:CatalogVideo,i:number)=>adaptVideo(v,i,1001)));
        }
        if(token()) {
          try {
            const res=await request('/api/auth/me');
            if(!cancelled&&res.user) {
              setAccount(res.user);
              const savedIds=(res.user.saved||[]) as string[];
              const converted=[...videos,...(feed.videos||[]).filter((v:CatalogVideo)=>v.type==='upload').map((v:CatalogVideo,i:number)=>adaptVideo(v,i,1001))].filter(v=>v.backendId && savedIds.includes(v.backendId)).map(v=>v.id);
              setSaved(converted);
            }
          } catch {localStorage.removeItem('miras_v3_token');}
        }
      } catch { /* Browse offline catalog even when cloud is unavailable */ }
    })();
    return ()=>{cancelled=true};
  },[apiBase]);
  useEffect(()=>{localStorage.setItem('miras_saved_magicpath',JSON.stringify(saved));},[saved]);
  useEffect(()=>{
    if(!ready || !active?.backendId) return;
    let cancelled=false;
    request('/api/videos/'+encodeURIComponent(active.backendId)+'/social').then(data=>{
      if(cancelled) return;
      setSocial(s=>({...s,[active.id]:data}));
      setComments(prev=>({...prev,[active.id]:(data.comments||[]).map((c:{text:string})=>c.text)}));
      if(data.liked) setLiked(ids=>ids.includes(active.id)?ids:[...ids,active.id]);
    }).catch(()=>{});
    return ()=>{cancelled=true};
  },[active?.id,ready]);
  const notice = (message:string)=>{setToast(message);window.setTimeout(()=>setToast(''),3500)};
  const videoPath = (v:Video) => '/api/videos/'+encodeURIComponent(v.backendId||'');
  const saveVideo = async (v:Video) => {
    if(ready && account && v.backendId) {
      try {const r=await request(videoPath(v)+'/save','POST',{});
        setSaved(all => r.bookmarked ? [...new Set([...all,v.id])] : all.filter(id=>id!==v.id));
      }catch(e){notice((e as Error).message)}
    } else {setSaved(all=>all.includes(v.id)?all.filter(id=>id!==v.id):[...all,v.id]);}
  };
  const likeVideo = async (v:Video) => {
    if(!ready||!account||!v.backendId){setAuthOpen(true);notice('Beğeniler için canlı hesap gerekiyor / Sign in to like');return}
    try{const r=await request(videoPath(v)+'/like','POST',{});
      setLiked(all=>r.liked?[...new Set([...all,v.id])]:all.filter(id=>id!==v.id));
      setSocial(all=>({...all,[v.id]:{...(all[v.id]||{comments:[]}),likes:r.likes,liked:r.liked}}));
    }catch(e){notice((e as Error).message)}
  };
  const authText: Record<Lang,{signIn:string;register:string;signOut:string;username:string;password:string;display:string;pick:string;publish:string;cloud:string}> = {
    tr:{signIn:'Giriş yap',register:'Hesap oluştur',signOut:'Çıkış yap',username:'Kullanıcı adı',password:'Şifre',display:'Görünen ad',pick:'Video seç (MP4 / WebM, en fazla 12 MB)',publish:'Videoyu yayımla',cloud:'Topluluk sunucusu hazır değil'},
    en:{signIn:'Sign in',register:'Create account',signOut:'Sign out',username:'Username',password:'Password',display:'Display name',pick:'Choose MP4 / WebM video (max 12 MB)',publish:'Publish video',cloud:'Community server is not configured'},
    de:{signIn:'Anmelden',register:'Konto erstellen',signOut:'Abmelden',username:'Benutzername',password:'Passwort',display:'Anzeigename',pick:'Video wählen (max. 12 MB)',publish:'Video veröffentlichen',cloud:'Community-Server nicht verfügbar'},
    fr:{signIn:'Connexion',register:'Créer un compte',signOut:'Déconnexion',username:'Nom d’utilisateur',password:'Mot de passe',display:'Nom affiché',pick:'Choisir une vidéo (max. 12 Mo)',publish:'Publier',cloud:'Service communautaire indisponible'},
    es:{signIn:'Entrar',register:'Crear cuenta',signOut:'Salir',username:'Usuario',password:'Contraseña',display:'Nombre visible',pick:'Elegir vídeo (máx. 12 MB)',publish:'Publicar',cloud:'Servidor comunitario no disponible'},
    ar:{signIn:'تسجيل الدخول',register:'إنشاء حساب',signOut:'تسجيل الخروج',username:'اسم المستخدم',password:'كلمة المرور',display:'الاسم الظاهر',pick:'اختر فيديو (12 ميغابايت كحد أقصى)',publish:'نشر الفيديو',cloud:'خادم المجتمع غير متاح'}
  };
  const submitAuth = async (event:React.FormEvent) => {
    event.preventDefault();
    if(!ready){notice(authText[lang].cloud);return}
    if(busy)return;
    setBusy(true);
    try{
      const result=await request('/api/auth/'+(authRegister?'register':'login'),'POST',{
        username:authName.trim().toLowerCase(),password:authPassword,
        ...(authRegister?{displayName:authDisplay.trim()||authName.trim()}:{})
      });
      localStorage.setItem('miras_v3_token',result.token);
      setAccount(result.user);
      const ids=(result.user.saved||[]) as string[];
      setSaved(all=>[...allVideos.filter(v=>v.backendId&&ids.includes(v.backendId)).map(v=>v.id)]);
      setAuthOpen(false);setAuthPassword('');
      notice(authRegister?'Account created / Hesap oluşturuldu':'Signed in / Giriş yapıldı');
    }catch(e){notice((e as Error).message)}finally{setBusy(false)}
  };
  const signOut = () => {localStorage.removeItem('miras_v3_token');setAccount(null);setLiked([]);notice(authText[lang].signOut)};

  const languageMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      window.localStorage.setItem('miras-language', lang);
    } catch {}
  }, [lang]);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (languageMenuRef.current && !languageMenuRef.current.contains(e.target as Node)) setLanguageOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  const viewport = useRef<HTMLDivElement>(null);
  const t = allStrings[lang],
    allVideos = useMemo(() => [...remoteVideos, ...(mine ? [mine] : []), ...videos], [remoteVideos, mine]);
  const title = (v: Video) => lang === 'tr' ? v.tr : lang === 'en' ? v.en : translatedVideoTitles[lang][v.id - 1] || v.en;
  const visible = useMemo(() => allVideos.filter(v => (cat === 'all' || v.cat === cat) && (v.tr + ' ' + v.en + ' ' + title(v) + ' ' + v.place + ' ' + v.author).toLowerCase().includes(query.toLowerCase())), [allVideos, cat, query, lang]);
  
  const go = (p: Tab) => {
    setTab(p);
    setCat('all');
    setQuery('');
    setSearch(false);
    viewport.current?.scrollTo({
      top: 0,
      behavior: 'instant' as ScrollBehavior
    });
  };
  const alert = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2600);
  };
  const share = async (v:Video) => {
    const url = ready && v.backendId ? (v.shareUrl || apiBase+'/watch/'+encodeURIComponent(v.backendId)) : v.link;
    if(!url){notice(t.unavailable);return}
    if(navigator.share){try{await navigator.share({title:title(v),url});return}catch{}}
    try{await navigator.clipboard.writeText(url);notice(t.copied)}catch{window.prompt(t.share,url)}
  };
  const addComment = async () => {
    if(!active || !comment.trim())return;
    if(!account || !ready || !active.backendId){setAuthOpen(true);notice(authText[lang].cloud);return}
    try{const data=await request(videoPath(active)+'/comment','POST',{text:comment.trim()});
      setComments(prev=>({...prev,[active.id]:(data.comments||[]).map((c:{text:string})=>c.text)}));
      setSocial(prev=>({...prev,[active.id]:{...(prev[active.id]||{likes:0,liked:false}),comments:data.comments||[]}}));
      setComment('');
    }catch(e){notice((e as Error).message)}
  };
  const addDraft = async () => {
    if(!ready){notice(authText[lang].cloud);return}
    if(!account){setUpload(false);setAuthOpen(true);return}
    if(!draftTitle.trim()||!uploadFile)return;
    if(uploadFile.size>12*1024*1024){notice('Maximum 12 MB');return}
    const form=new FormData();form.append('video',uploadFile);form.append('title',draftTitle.trim());
    form.append('description',draftTitle.trim());form.append('category',cat==='art'?'arts':cat==='all'?'places':cat);
    setBusy(true);
    try{const data=await request('/api/upload','POST',form);
      const created=adaptVideo(data.video,0,1001+remoteVideos.length);
      setRemoteVideos(all=>[created,...all]);setUpload(false);setUploadFile(null);
      setDraftTitle('');go('home');notice(t.created);
    }catch(e){notice((e as Error).message)}finally{setBusy(false)}
  };
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActive(null);
        setSearch(false);
        setUpload(false);
      }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, []);
  const fallback = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.dataset.fallback) return;
    e.currentTarget.dataset.fallback = '1';
    e.currentTarget.src = 'img/poster-unavailable.svg';
  };
  const filters = <div className="no-scrollbar flex overflow-x-auto gap-2 py-1 pr-6" role="tablist" aria-label="Categories">{categoryItems.map(c => <button type="button" key={c.id} role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)} className={'whitespace-nowrap rounded-full border px-4 py-2.5 text-[11px] font-bold transition ' + (cat === c.id ? 'bg-[#224636] border-[#224636] text-white' : 'bg-white border-[#E7EAE4] text-[#607366]')}>{categoryNames[lang][categoryItems.indexOf(c)]}</button>)}</div>;
  const tile = (v: Video) => <article key={v.id} className="min-w-0 group"><button type="button" onClick={() => setActive(v)} className="relative aspect-[1.52] w-full overflow-hidden bg-[#D8DFD8] rounded-[17px] text-left"><img src={v.image} onError={fallback} alt={title(v)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /><span className="absolute top-2.5 left-2.5 flex gap-1 items-center bg-[#12241C]/70 backdrop-blur px-2.5 py-1.5 text-white text-[10px] font-semibold rounded-full"><MapPin size={10} />{v.place}</span><span className="absolute bottom-2 right-2 bg-black/75 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded-lg">{v.time}</span><span className="absolute inset-0 opacity-0 group-hover:opacity-100 grid place-items-center bg-black/20 transition-opacity"><span className="bg-white text-[#224636] w-11 h-11 rounded-full grid place-items-center"><Play size={19} fill="currentColor" className="ml-0.5" /></span></span></button><div className="flex items-start gap-1 pt-2.5"><button type="button" className="min-w-0 text-left flex-1" onClick={() => setActive(v)}><div className="text-[#223D2F] text-[13px] font-extrabold leading-[1.38] line-clamp-2">{title(v)}</div><div className="text-[10px] text-[#94A095] flex flex-wrap gap-1 mt-1"><span>{v.author}</span><span>·</span><span>{v.views}</span></div></button><button type="button" onClick={() => {void saveVideo(v)}} aria-label="Bookmark" className={'shrink-0 p-1.5 rounded-lg ' + (saved.includes(v.id) ? 'text-[#1D7757] bg-[#E4F2E8]' : 'text-[#9BA99F]')}><Bookmark size={16} fill={saved.includes(v.id) ? 'currentColor' : 'none'} /></button></div></article>;
  return <div lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} className="miras-app relative flex flex-col overflow-hidden bg-[#F8F8F4] text-[#24392E] w-full h-[100dvh] max-h-[932px] min-h-[560px]" style={{
    fontFamily: 'Inter,system-ui,sans-serif'
  }}>
<header className="relative z-40 shrink-0 px-[22px] pt-[19px] pb-[15px] bg-[#F8F8F4]/95 backdrop-blur-xl flex justify-between items-center border-b border-[#E8EBE5]"><button type="button" onClick={() => go('home')} className="flex gap-2.5 items-center text-left"><span className="w-10 h-10 rounded-[14px] grid place-items-center bg-[#D65F40] text-white text-[24px] font-serif font-black shadow-[0_5px_12px_rgba(214,95,64,.2)]">M</span><span className="flex flex-col"><span className="text-[21px] font-black tracking-[-.09em] text-[#1C3E2D] leading-none">MİRAS<span className="text-[#D65F40]">.</span></span><span className="text-[8px] tracking-[.22em] font-extrabold text-[#95A093] mt-1">TÜRKİYE STORIES</span></span></button><div className="flex items-center gap-1.5"><div className="relative" ref={languageMenuRef}><button type="button" aria-label={languageNames[lang]} aria-haspopup="listbox" aria-expanded={languageOpen} onClick={() => setLanguageOpen(v => !v)} className="flex gap-1.5 items-center rounded-full border border-[#E5EAE2] bg-white px-2.5 h-9 text-[10px] font-extrabold"><span className="text-sm">{languages.find(x => x.code === lang)?.flag}</span>{lang.toUpperCase()}<ChevronDown size={10} /></button>{languageOpen && <div role="listbox" aria-label={languageNames[lang]} className="absolute top-11 right-0 z-[75] min-w-[190px] rounded-[17px] border border-[#E3EBE0] bg-white p-2 shadow-[0_14px_38px_rgba(20,52,36,.24)]"><p className="px-3 pt-2 pb-1 text-[10px] font-bold text-[#849888]">{languageNames[lang]}</p>{languages.map(x => <button type="button" role="option" aria-selected={lang === x.code} key={x.code} onClick={() => {
              setLang(x.code);
              setLanguageOpen(false);
            }} className={'w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[12px] font-semibold ' + (lang === x.code ? 'bg-[#E8F2E7] text-[#24533C]' : 'text-[#4B6051] hover:bg-[#F0F4ED]')}><span className="flex items-center gap-2.5"><span className="text-lg">{x.flag}</span>{x.name}</span>{lang === x.code && <Check size={15} />}</button>)}</div>}</div><button type="button" onClick={() => setSearch(true)} aria-label="Search" className="h-9 w-9 rounded-full bg-[#E8EDE5] grid place-items-center"><Search size={17} /></button><button type="button" onClick={() => go('profile')} aria-label="Profile" className="h-9 w-9 rounded-full bg-[#E1E9DC] grid place-items-center text-[#28553D]"><UserRound size={17} /></button></div></header>
<div ref={viewport} data-testid="miras-scroll-content" className="miras-scroll no-scrollbar flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y pb-6">
{tab === 'home' && !search && <main><section className="px-[22px] pt-7"><div className="flex justify-between gap-3 items-center"><div><div className="text-[#B9654B] flex items-center gap-2 text-[9px] font-extrabold tracking-[.2em]"><span className="rounded-full w-1.5 h-1.5 bg-[#D65F40]" />{t.welcome}</div><h1 className="miras-serif mt-2 text-[33px] text-[#1D3C2E] leading-[1.09] tracking-[-.035em]">{t.one}</h1><p className="text-[#93A094] text-[12px] mt-2">{t.desc}</p></div><span className="shrink-0 flex items-center justify-center rounded-full border border-[#D8E0D3] w-[54px] h-[54px] -rotate-12 text-[#D65F40] text-[35px]">✦</span></div><div className="mt-5 -mr-[22px]">{filters}</div></section>
<section className="px-[22px] mt-6"><button type="button" onClick={() => setActive(videos[0])} className="relative w-full h-[330px] text-left overflow-hidden rounded-[25px] shadow-[0_15px_35px_rgba(30,50,32,.17)] group"><img src={videos[0].image} onError={fallback} alt={title(videos[0])} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700" /><span className="absolute inset-0 bg-gradient-to-t from-[#071C16]/95 via-[#153222]/30 to-[#112E24]/20" /><span className="absolute top-5 left-5 text-white rounded-full bg-white/15 px-3 py-2 flex items-center gap-1.5 text-[10px] tracking-[.11em] font-bold backdrop-blur-md"><Sparkles size={11} />{t.featured}</span><span className="absolute top-5 right-5 bg-white/90 rounded-full px-3 py-1.5 text-[#2B4C38] font-bold text-[11px]">01 / 28</span><span className="absolute bottom-0 inset-x-0 px-5 pb-5"><span className="text-[#E5C9A5] text-[10px] tracking-[.2em] font-extrabold">{videos[0].place.toUpperCase()}</span><span className="miras-serif mt-2 block max-w-[290px] text-white text-[31px] tracking-[-.03em] leading-[1.06]">{title(videos[0])}</span><span className="flex items-center justify-between mt-4"><span className="inline-flex items-center gap-2 text-white text-[12px] font-bold"><span className="rounded-full grid place-items-center bg-[#E2F1D9] text-[#204735] w-10 h-10"><Play size={18} className="ml-0.5" fill="currentColor" /></span>{t.watch}</span><span className="text-white/80 text-[11px] flex items-center gap-1.5"><Clock size={12} />{videos[0].time}</span></span></span></button><div className="flex justify-center gap-1.5 mt-3"><span className="w-5 h-1.5 bg-[#D65F40] rounded-full" /><span className="w-1.5 h-1.5 bg-[#DEE2DA] rounded-full" /><span className="w-1.5 h-1.5 bg-[#DEE2DA] rounded-full" /></div></section>
<section className="px-[22px] mt-9"><div className="flex items-end justify-between mb-4"><div><div className="text-[#BC7352] text-[9px] font-extrabold tracking-[.2em]">{t.day}</div><h2 className="miras-serif text-[26px] tracking-[-.035em] text-[#233C30] mt-1">{t.selected}</h2></div><button type="button" onClick={() => go('explore')} className="text-[11px] text-[#A7654C] font-bold flex items-center gap-1">{t.all}<ArrowRight size={14} /></button></div><div className="grid grid-cols-2 gap-3">{(cat === 'all' ? allVideos.slice(1, 5) : visible).map(tile)}</div>{visible.length === 0 && <div className="text-center text-[12px] text-[#94A095] py-10">{t.empty}</div>}</section>
<section className="mx-[22px] mt-9 rounded-[24px] p-5 overflow-hidden relative bg-[#1C3C2E] text-white"><div className="absolute w-44 h-44 rounded-full border border-white/10 -right-16 -top-14" /><div className="relative text-[#E1BA90] text-[10px] font-bold tracking-[.17em] flex items-center gap-2"><Clapperboard size={14} />{t.picks}</div><div className="relative flex items-center justify-between mt-3"><div><h2 className="miras-serif text-[27px] leading-tight">{t.long}</h2><p className="text-[11px] text-[#BECEC0] mt-1">{t.longSub}</p></div><ArrowRight size={20} /></div><div className="grid grid-cols-2 gap-3 mt-5 relative miras-dark-tiles">{allVideos.filter(v => v.doc).slice(0, 2).map(tile)}</div></section><p className="text-center text-[10px] text-[#A1ACA2] tracking-wide my-8">{t.source} · Wikimedia Commons</p></main>}
{tab === 'explore' && !search && <main className="px-[22px] pt-8"><div className="text-[10px] text-[#BE7552] font-extrabold tracking-[.2em]">MİRAS ATLAS</div><h1 className="miras-serif text-[35px] text-[#1D3D2E] tracking-[-.04em] mt-2 leading-tight">{t.exploreTitle}<span className="text-[#D65F40]">.</span></h1><p className="text-[12px] text-[#92A096] mt-1">{t.exploreDesc}</p><button type="button" onClick={() => setSearch(true)} className="flex items-center gap-3 rounded-[15px] w-full text-left px-4 py-4 bg-white border border-[#E3EAE0] text-[#9BA69B] text-[12px] mt-5"><Search size={17} />{t.search}</button><div className="-mr-[22px] mt-4">{filters}</div><div className="mt-6 grid grid-cols-2 gap-3">{visible.map(tile)}</div>{!visible.length && <p className="text-center text-[12px] text-[#94A095] mt-12">{t.empty}</p>}</main>}
{tab === 'saved' && !search && <main className="px-[22px] pt-8"><span className="w-12 h-12 bg-[#E0ECE1] text-[#376E50] rounded-[17px] grid place-items-center"><Bookmark size={24} /></span><h1 className="miras-serif text-[34px] text-[#1E3B2F] mt-4">{t.saveTitle}</h1><p className="text-[12px] text-[#94A095] mt-2">{t.saveDesc}</p><div className="grid grid-cols-2 gap-3 mt-7">{allVideos.filter(v => saved.includes(v.id)).map(tile)}</div>{!saved.length && <div className="py-20 text-[#94A095] text-[12px] text-center">{t.saveDesc}</div>}</main>}
{tab === 'profile' && !search && <main className="px-[22px] pt-8"><div className="h-40 rounded-[24px] bg-[#244735] relative overflow-hidden"><div className="w-52 h-52 rounded-full border border-[#A5C2A8]/25 absolute -right-12 -top-20" /><div className="w-40 h-40 rounded-full border border-[#A5C2A8]/25 absolute -right-8 -top-14" /><span className="absolute bottom-5 left-5 miras-serif text-white text-[32px]">MİRAS<span className="text-[#E5A07D]">.</span></span></div><div className="relative -mt-7 mx-4 flex items-end justify-between"><span className="w-[76px] h-[76px] bg-[#E9D9B8] border-[5px] border-[#F8F8F4] rounded-[22px] grid place-items-center text-[#325942]"><UserRound size={30} /></span><button type="button" onClick={() => {
            setLanguageOpen(true);
          }} className="mb-1 border border-[#CEDACD] rounded-full px-4 py-2 text-[11px] font-bold flex items-center gap-1.5"><Globe2 size={13} />{languages.find(x => x.code === lang)?.name}<ChevronDown size={12} /></button></div><h1 className="miras-serif text-[#244635] text-[29px] mt-5">{t.profileTitle}</h1><p className="text-[#849589] text-[12px] mt-1">{t.profileDesc}</p><div className="mt-6 rounded-2xl border border-[#DFE8DD] bg-white p-4">
  {account ? <div className="flex justify-between items-center gap-3"><span className="text-[12px] font-bold">@{account.username}</span><button className="text-[12px] text-[#AA5641] font-semibold" onClick={signOut}>{authText[lang].signOut}</button></div> :
  <button className="w-full rounded-xl p-3 bg-[#224636] text-white text-[12px] font-bold" onClick={()=>setAuthOpen(true)}>{authText[lang].signIn} / {authText[lang].register}</button>}
  <p className="text-[10px] text-[#799080] mt-2">{ready?'MİRAS community · Online':authText[lang].cloud}</p>
</div><div className="grid grid-cols-3 gap-2 mt-7">{[{
            n: allVideos.length,
            l: statLabels[lang][0]
          }, {
            n: saved.length,
            l: statLabels[lang][1]
          }, {
            n: liked.length,
            l: statLabels[lang][2]
          }].map(x => <div key={x.l} className="rounded-[17px] p-4 text-center bg-white border border-[#EDF0E8]"><div className="miras-serif text-[26px]">{x.n}</div><span className="text-[10px] text-[#95A599]">{x.l}</span></div>)}</div><button type="button" onClick={() => setUpload(true)} className="w-full bg-[#D75E41] rounded-[15px] text-white font-bold text-[12px] py-4 flex items-center justify-center gap-2 mt-7"><Plus size={17} />{t.uploadTitle}</button><p className="text-center text-[#A1ACA2] text-[10px] mt-6">{t.notice}</p></main>}
{search && <main className="px-[22px] pt-8"><div className="flex items-center gap-3"><button type="button" aria-label="Back" onClick={() => {
            setSearch(false);
            setQuery('');
          }} className="p-2.5 bg-[#E9EEE7] rounded-full"><ArrowLeft size={18} /></button><h1 className="miras-serif text-[26px] text-[#244635]">{t.searchTitle}</h1></div><div className="relative mt-6"><Search size={17} className="absolute top-4 left-4 text-[#91A195]" /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder={t.search} className="w-full py-4 pl-11 pr-4 text-[12px] outline-none rounded-[15px] border border-[#DAE4DB] bg-white" /></div><div className="-mr-[22px] mt-4">{filters}</div><div className="grid grid-cols-2 gap-3 mt-6">{visible.map(tile)}</div>{!visible.length && <p className="text-center text-[12px] text-[#94A095] mt-10">{t.empty}</p>}</main>}
</div>
<nav className="z-30 relative shrink-0 h-[85px] rounded-t-[22px] bg-white/95 backdrop-blur border-t border-[#E6EBE3] shadow-[0_-8px_30px_rgba(42,65,41,.06)] px-2 pt-2 pb-3 flex justify-around">{([{
        key: 'home',
        icon: Home,
        label: t.home
      }, {
        key: 'explore',
        icon: Compass,
        label: t.explore
      }, {
        key: 'upload',
        icon: Plus,
        label: t.upload
      }, {
        key: 'saved',
        icon: Bookmark,
        label: t.saved
      }, {
        key: 'profile',
        icon: UserRound,
        label: t.profile
      }] as const).map(n => {
        const Icon = n.icon;
        const selected = tab === n.key && !search;
        return <button type="button" key={n.key} onClick={() => n.key === 'upload' ? setUpload(true) : go(n.key)} className={'flex flex-col flex-1 items-center justify-center gap-1 text-[9px] font-bold ' + (selected ? 'text-[#255943]' : 'text-[#A5B0A7]')}><span className={'w-10 h-9 grid place-items-center ' + (n.key === 'upload' ? 'h-10 -mt-2 mb-[-3px] rounded-[13px] bg-[#D75F41] shadow-md text-white' : selected ? 'rounded-[12px] bg-[#E9F2E9]' : '')}><Icon size={n.key === 'upload' ? 21 : 19} strokeWidth={selected ? 2.5 : 1.8} /></span>{n.label}</button>;
      })}</nav>
{authOpen && <div role="dialog" aria-modal="true" className="absolute z-[70] inset-0 flex items-end bg-[#0A2119]/70 backdrop-blur-sm">
  <form onSubmit={submitAuth} className="w-full bg-[#F9FAF7] p-6 pb-10 rounded-t-[28px] shadow-2xl">
    <div className="flex justify-between items-center"><h2 className="miras-serif text-[28px] text-[#1D3F2D]">{authRegister?authText[lang].register:authText[lang].signIn}</h2><button type="button" onClick={()=>setAuthOpen(false)} className="rounded-full p-2 bg-[#E8EDE6]" aria-label="Close"><X size={20}/></button></div>
    {!ready && <p className="text-[#B25B45] mt-3 text-[12px]">{authText[lang].cloud}</p>}
    <label className="block text-[12px] mt-5">{authText[lang].username}<input autoComplete="username" required value={authName} onChange={e=>setAuthName(e.target.value)} minLength={3} maxLength={24} className="block bg-white border rounded-xl p-3 w-full mt-1" /></label>
    {authRegister && <label className="block text-[12px] mt-3">{authText[lang].display}<input value={authDisplay} onChange={e=>setAuthDisplay(e.target.value)} className="block bg-white border rounded-xl p-3 w-full mt-1" /></label>}
    <label className="block text-[12px] mt-3">{authText[lang].password}<input autoComplete={authRegister?"new-password":"current-password"} required type="password" minLength={8} value={authPassword} onChange={e=>setAuthPassword(e.target.value)} className="block bg-white border rounded-xl p-3 w-full mt-1" /></label>
    <button type="submit" disabled={busy||!ready} className="mt-5 w-full bg-[#255D43] text-white rounded-xl p-4 font-bold disabled:opacity-50">{busy?'…':authRegister?authText[lang].register:authText[lang].signIn}</button>
    <button type="button" className="block mx-auto mt-4 text-[#B7654C] text-[12px] font-semibold" onClick={()=>setAuthRegister(s=>!s)}>{authRegister?authText[lang].signIn:authText[lang].register}</button>
  </form>
</div>}
{active && <div role="dialog" aria-modal="true" aria-label={title(active)} className="z-50 absolute inset-0 bg-[#0A2119]/70 backdrop-blur-sm flex items-end justify-center"><div className="w-full bg-[#F9FAF7] rounded-t-[27px] max-h-[92%] overflow-y-auto no-scrollbar miras-rise"><div className="flex items-center justify-between px-5 py-3"><span className="flex items-center gap-1.5 text-[10px] tracking-[.17em] font-black text-[#597862]"><span className="w-1.5 h-1.5 bg-[#D85E41] rounded-full" />MİRAS STORIES</span><button type="button" onClick={() => {
            setActive(null);
            setComment('');
          }} className="bg-[#E8EDE6] p-2 rounded-full" aria-label="Close"><X size={17} /></button></div><div className="aspect-video relative bg-[#172E22]">{active.src ? <video key={active.id} controls autoPlay playsInline poster={active.image} className="h-full w-full bg-black object-contain"><source src={active.src} type={active.src.toLowerCase().includes(".mp4") ? "video/mp4" : "video/webm"} /></video> : <><img src={active.image} onError={fallback} className="h-full w-full object-cover opacity-75" alt={title(active)} /><div className="absolute inset-0 bg-black/30 grid place-content-center text-center text-white p-8"><Play size={32} className="mx-auto mb-3" /><span className="text-[11px] leading-relaxed max-w-[250px]">{t.unavailable}</span></div></>}</div><div className="px-5 pb-7"><span className="block mt-5 text-[10px] font-black tracking-[.2em] text-[#C17750]">{active.place.toUpperCase()} · MİRAS</span><h2 className="miras-serif text-[#1C3E2D] text-[29px] leading-[1.1] mt-2">{title(active)}</h2><div className="flex items-center gap-2 text-[#9BA69C] text-[11px] mt-3"><Clock size={12} />{active.time}<span>·</span>{active.views}</div><div className="flex gap-2 mt-5"><button type="button" onClick={() => {void likeVideo(active)}} className={'flex-1 border rounded-xl py-3 text-[11px] font-bold flex items-center justify-center gap-1.5 ' + (liked.includes(active.id) ? 'bg-[#FCE8E3] text-[#CA5740] border-[#F0C1B4]' : 'bg-white border-[#E1E8E0]')}><Heart size={15} fill={liked.includes(active.id) ? 'currentColor' : 'none'} />{t.like}</button><button type="button" onClick={() => {void saveVideo(active)}} className={'flex-1 border rounded-xl py-3 text-[11px] font-bold flex items-center justify-center gap-1.5 ' + (saved.includes(active.id) ? 'bg-[#DFF2E4] text-[#24704C] border-[#B9E0C6]' : 'bg-white border-[#E1E8E0]')}><Bookmark size={15} fill={saved.includes(active.id) ? 'currentColor' : 'none'} />{t.saved}</button><button type="button" onClick={() => share(active)} className="flex-1 bg-white border border-[#E1E8E0] rounded-xl py-3 text-[11px] font-bold flex items-center justify-center gap-1.5"><Share2 size={15} />{t.share}</button></div><div className="mt-5 p-4 rounded-[15px] bg-[#EDF3EA] text-[#617467] text-[12px] leading-relaxed">{heritageTexts[lang]}</div><div className="flex items-center gap-3 border-b border-[#E6ECE5] py-5"><span className="w-10 h-10 bg-[#DDE9DA] text-[#3D6A4D] rounded-full grid place-items-center font-bold">{active.author.slice(0, 1)}</span><span className="min-w-0 flex-1"><span className="text-[#2B4C37] text-[12px] font-bold block">{active.author}</span><span className="text-[10px] text-[#99A69B] block mt-1">{active.credit}</span></span><button type="button" className="rounded-full border border-[#C4DBC9] text-[#3A7552] px-3 py-2 text-[11px] font-bold" onClick={() => notice('Following creators will be available when supported by MİRAS.')}>{follows.includes(active.author) ? t.following : t.follow}</button></div><a href={active.link} target="_blank" rel="noopener noreferrer" className="mt-4 text-[#348062] font-bold text-[11px] inline-flex gap-1.5 items-center"><ExternalLink size={14} />{t.source}</a><h3 className="flex items-center gap-2 text-[15px] mt-7 font-bold"><MessageCircle size={17} />{t.comments} <span className="text-[#A2AEA3]">{(comments[active.id] || []).length}</span></h3><div className="space-y-2 mt-3">{(comments[active.id] || []).map((c, i) => <p key={i} className="text-[12px] text-[#526E59] bg-white border border-[#E6EAE2] p-3 rounded-xl"><b>Guest</b><span className="block mt-1">{c}</span></p>)}</div><div className="flex gap-2 mt-3"><input value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment()} placeholder={t.comment} className="min-w-0 flex-1 px-3 py-3 rounded-xl border border-[#E0E8DF] bg-white text-[12px] outline-none" /><button type="button" onClick={addComment} disabled={!comment.trim()} className="rounded-xl px-4 bg-[#255D43] text-white disabled:opacity-40"><Send size={16} /></button></div></div></div></div>}
{upload && <div role="dialog" aria-modal="true" aria-label={t.uploadTitle} className="absolute inset-0 z-50 flex items-end bg-[#0A2119]/70 backdrop-blur-sm"><div className="w-full rounded-t-[27px] bg-[#F9FAF7] p-6 miras-rise"><div className="flex justify-between"><span className="rounded-[15px] bg-[#E4EEE3] p-3 text-[#2B6546]"><Upload size={22} /></span><button type="button" onClick={() => setUpload(false)} aria-label="Close" className="bg-[#E8EDE6] rounded-full p-2 h-9"><X size={18} /></button></div><h2 className="miras-serif text-[29px] text-[#1D3F2D] mt-5">{t.uploadTitle}</h2><p className="text-[#849486] text-[12px] mt-2">{t.uploadDesc}</p><label className="block mt-6 font-bold text-[#52705B] text-[11px]">{t.title}<input value={draftTitle} onChange={e => setDraftTitle(e.target.value)} className="block w-full mt-2 rounded-xl border border-[#DCE6DA] p-4 bg-white text-[13px] outline-none" placeholder={t.title} /></label><label className="block mt-4 font-bold text-[#52705B] text-[11px]">{authText[lang].pick}<input type="file" accept="video/mp4,video/webm,.mp4,.webm" onChange={e=>setUploadFile(e.target.files?.[0]||null)} className="block w-full mt-2 rounded-xl border border-[#DCE6DA] p-4 bg-white text-[13px] outline-none" /></label><div className="flex gap-2 mt-5 text-[11px] bg-[#EAF1E8] p-3 rounded-xl text-[#617866]"><Info size={16} className="shrink-0" />{ready ? t.uploadDesc : authText[lang].cloud}</div><button type="button" disabled={!draftTitle.trim() || !uploadFile || busy} onClick={addDraft} className="w-full bg-[#D75F41] text-white py-4 mt-5 rounded-xl font-bold text-[12px] disabled:opacity-40">{busy?'…':authText[lang].publish}</button></div></div>}
{toast && <div role="status" className="absolute z-[80] bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-[#255441] text-white shadow-xl px-4 py-3 whitespace-nowrap text-[11px] flex items-center gap-2"><Check size={14} />{toast}</div>}
</div>;
};