import React from 'react';
import { Camera, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../components/common/StateViews';
import { useGallery, useSection } from '../hooks/useTourismQueries';
import { getSectionEntry } from '../lib/sectionRegistry';
import { resolveImage } from '../lib/resolveImage';
import { GalleryItem, Language } from '../types';

/* ─── Permanent gallery data — hardcoded so it never disappears ─────────────
   These 17 items map 1-to-1 to the images in /public/assets/aistudio/.
   Add new images here; this list is the single source of truth for the
   gallery page and is never overwritten by a snapshot rebuild.
──────────────────────────────────────────────────────────────────────────── */
const HARDCODED_GALLERY: GalleryItem[] = [
  {
    id: 'gal-1', year: 2024, category: 'culture', mediaType: 'image',
    url: '/assets/aistudio/image_c9b19ed8.png', thumbnail: '/assets/aistudio/image_c9b19ed8.png',
    titleI18n: { en: 'Pan-Ethiopian Cultural Attire Assembly', am: 'የሁሉም-ኢትዮጵያ ባህላዊ አልባሳት ስብስብ', om: 'Walitti Qabama Uffata Aadaa Itoophiyaa Hundaa' },
    captionI18n: { en: 'Students representing all regions of Ethiopia showcasing the rich tapestry of indigenous dress, embroidery, and ornaments.', am: 'ከሁሉም የኢትዮጵያ ክልሎች የተውጣጡ ተማሪዎች የሀገሪቱን የባህል አልባሳት ሲያሳዩ።', om: 'Barattoonni fi qindeessitoonni uffata aadaa saboota adda addaa yeroo agarsiisan.' },
  },
  {
    id: 'gal-2', year: 2024, category: 'culture', mediaType: 'image',
    url: '/assets/aistudio/image_9108d7cc.png', thumbnail: '/assets/aistudio/image_9108d7cc.png',
    titleI18n: { en: 'Traditional Oromo Cavalry & Decorated Stallions Parade', am: 'የባህላዊ ፈረሰኞች ሰልፍ እና የፈረስ ጌጦች ትዕይንት በወሊሶ', om: 'Hiriira Abbootii Fardaa fi Faaya Farda Aadaa Walisoo' },
    captionI18n: { en: 'Spectacular procession of traditional cavalry mounted on decorated horses with ceremonial red and yellow harness along Woliso boulevard.', am: 'በቀይ እና ቢጫ ያጌጡ ፈረሰኞች በወሊሶ ጎዳናዎች ላይ ያደረጉት አስደናቂ ትዕይንት።', om: 'Abbootiin fardaa fardeen miidhagsanii daandii Walisoo irratti yeroo hiriiran.' },
  },
  {
    id: 'gal-3', year: 2024, category: 'competition', mediaType: 'image',
    url: '/assets/aistudio/image_db590259.png', thumbnail: '/assets/aistudio/image_db590259.png',
    titleI18n: { en: 'Miss & Mr. Tourism Campus Grand Coronation', am: 'የወሊሶ ካምፓስ ሚስ እና ሚስተር ቱሪዝም ዘውድ ማልበስ ስነ-ስርዓት', om: 'Sirna Badhaasa Eebba Miss fi Mr. Turizimii Kaampasii Walisoo' },
    captionI18n: { en: 'Grand coronation inside the campus auditorium featuring the crowned Miss Tourism, delegates, and celebratory stage lights.', am: 'በካምፓሱ አዳራሽ የተካሄደው የቱሪዝም አምባሳደሮች የዘውድ ማልበስ እና የዕውቅና ስነ-ስርዓት።', om: 'Galma Kaampasii Walisoo keessatti sirna gonfoo uffisuu fi badhaasa dorgommii bareedinaa.' },
  },
  {
    id: 'gal-4', year: 2024, category: 'culture', mediaType: 'image',
    url: '/assets/aistudio/image_e6296589.png', thumbnail: '/assets/aistudio/image_e6296589.png',
    titleI18n: { en: 'Celebration Street Carnival & Joyful Youth Dance', am: 'የጎዳና ላይ የደስታ ዳንስ እና የቱሪዝም ሳምንት ባነር ሰልፍ', om: 'Shubbisa Aadaa fi Gammachuu Daandii Irratti Barattootaan' },
    captionI18n: { en: 'Students and youth performing energetic dances and songs along Woliso avenue with the official Department of Tourism banner.', am: 'ተማሪዎችና ወጣቶች የወሊሶ ጎዳናዎችን በባህላዊ ጭፈራና በደስታ አጅበው ሲጓዙ።', om: 'Barattoonni fi dargaggoonni shubbisa aadaatiin daandii Walisoo yeroo miidhagsan.' },
  },
  {
    id: 'gal-5', year: 2024, category: 'culture', mediaType: 'image',
    url: '/assets/aistudio/image_7544bf77.png', thumbnail: '/assets/aistudio/image_7544bf77.png',
    titleI18n: { en: 'Mounted Horsemen Cavalry Guard with Traditional Shields', am: 'የባህላዊ ጋሻ እና ጦር የታጠቁ ፈረሰኞች የክብር ሰልፍ', om: 'Eegumsa Fardeen Aadaa fi Gaachana Seena-qabeessa' },
    captionI18n: { en: 'Historic cavalry lineup holding traditional embossed metal shields and ceremonial spears lining the main road.', am: 'የአባገዳ ባህላዊ ጋሻ እና ጦር የታጠቁ ፈረሰኞች በክብር ሰልፍ ላይ።', om: 'Abbootii fardaa gaachana fi eboo qabatanii hiriira kabajaa irratti.' },
  },
  {
    id: 'gal-6', year: 2024, category: 'sports', mediaType: 'image',
    url: '/assets/aistudio/image_3856f7f5.png', thumbnail: '/assets/aistudio/image_3856f7f5.png',
    titleI18n: { en: 'Great Woliso Morning Carnival March & Athletic Peloton', am: 'የጠዋቱ የወሊሶ ጎዳና ካርኒቫል ሰልፍ እና ሩጫ', om: 'Hiriira Kaarnivaalii Ganamaa fi Fiigicha Daandii Walisoo' },
    captionI18n: { en: 'Morning running peloton and festive cultural march through Woliso downtown in golden morning sunlight.', am: 'የጠዋቱ የወሊሶ ከተማ ታላቁ የጎዳና ላይ ሩጫ እና የደስታ ሰልፍ።', om: 'Fiigicha guddaa ganamaa fi soochii aadaa daandii magaalichaa irratti.' },
  },
  {
    id: 'gal-7', year: 2024, category: 'culture', mediaType: 'image',
    url: '/assets/aistudio/image_e2e72d06.png', thumbnail: '/assets/aistudio/image_e2e72d06.png',
    titleI18n: { en: 'Tourism Week Exhibition Pavilion & Cultural Hostesses', am: 'የቱሪዝም ሳምንት የኤግዚቢሽን ድንኳን እና ባህላዊ አልባሳት', om: 'Dunkana Agarsiisa Turizimii fi Dubartoota Uffata Aadaa' },
    captionI18n: { en: 'Hospitality and tourism students in vibrant cultural attire welcoming guests at the Ambo University Woliso Campus pavilion.', am: 'የሆቴል እና ቱሪዝም ማኔጅመንት ሴት ተማሪዎች በባህላዊ አልባሳት በኤግዚቢሽኑ ድንኳን ፊት።', om: 'Barattoonni dubaraa uffata aadaatiin keessummoota dunkana agarsiisaatti simatan.' },
  },
  {
    id: 'gal-8', year: 2024, category: 'culture', mediaType: 'image',
    url: '/assets/aistudio/image_d5bf61c0.png', thumbnail: '/assets/aistudio/image_d5bf61c0.png',
    titleI18n: { en: 'Traditional Stick Dance & Peace Procession', am: 'የባህላዊ ዘንግ ጭፈራ እና የቱሪዝም ለሰላም ሰልፍ', om: 'Dhiichisa Ulee Aadaa fi Hiriira Nageenyaa Turizimii' },
    captionI18n: { en: 'Choreographed traditional stick march carrying the "Tourism for Peace and Stability" banner along the campus route.', am: 'ተማሪዎች ባህላዊ ዱላና ሻማ በመያዝ "ቱሪዝም ለሰላምና ለዘላቂ ልማት" መሪ ቃልን ሲያስተጋቡ።', om: 'Dhiichisa ulee aadaa fi dhaadannoo "Turizimiin Nageenyaaf" jedhu qabatanii.' },
  },
  {
    id: 'gal-9', year: 2024, category: 'academic', mediaType: 'image',
    url: '/assets/aistudio/image_25e4d059.png', thumbnail: '/assets/aistudio/image_25e4d059.png',
    titleI18n: { en: 'Department Faculty & Student Leadership Delegation', am: 'የቱሪዝም እና ሆቴል ማኔጅመንት ትምህርት ክፍል መምህራን እና ተማሪዎች', om: 'Barsiisota fi Barattoota Muummee Turizimii fi Bulchiinsa Hoteelaa' },
    captionI18n: { en: 'Faculty professors, department leadership, and student organizers gathered outside the university academic block.', am: 'የክፍሉ መምህራን እና የተማሪዎች ኮሚቴ በካምፓሱ ህንፃ ፊት ያደረጉት የወዳጅነት ፎቶ።', om: 'Barsiisonni muummee fi barattoonni gamoo kaampasii fuulduratti waloon.' },
  },
  {
    id: 'gal-10', year: 2024, category: 'community', mediaType: 'image',
    url: '/assets/aistudio/image_fe8a90e0.png', thumbnail: '/assets/aistudio/image_fe8a90e0.png',
    titleI18n: { en: 'Civic Sanitation & Town Beautification Volunteer Brigade', am: 'የወሊሶ ከተማ እና ካምፓስ የፅዳት ዘመቻ በጎ ፈቃደኞች', om: 'Duula Qulqullina Magaalaa Walisoo fi Kaampasii Barattootaan' },
    captionI18n: { en: 'Over a hundred students and staff mobilized with brooms, shovels, and sanitary gear for community environmental day.', am: 'በመጥረጊያ እና አካፋ የታጠቁ ተማሪዎችና ሰራተኞች ከተማዋን ለበዓሉ በፅዳት ሲያዘጋጁ።', om: 'Barattoonni fi hojjettoonni haxaa fi baalawa qabatanii qulqullina naannoo yeroo eegsisan.' },
  },
  {
    id: 'gal-11', year: 2024, category: 'community', mediaType: 'image',
    url: '/assets/aistudio/image_a7c5afdc.png', thumbnail: '/assets/aistudio/image_a7c5afdc.png',
    titleI18n: { en: 'Eco-Tourism Campus Cleanup & Brush Clearing', am: 'የአካባቢ ጥበቃ እና የካምፓስ አረንጓዴ ልማት ስራ', om: 'Hojii Qulqullina Naannoo fi Eegumsa Bosonaa Kaampasii' },
    captionI18n: { en: 'Volunteers gathering brush and debris to prepare the open-air venues for the celebration week.', am: 'የካምፓሱን አረንጓዴ ስፍራዎች እና ሜዳዎች የማፅዳት በጎ ፈቃድ ስራ።', om: 'Muka fi qulqullina dirree qindeessuun mooraa qulqulleessuu.' },
  },
  {
    id: 'gal-12', year: 2024, category: 'community', mediaType: 'image',
    url: '/assets/aistudio/image_731dbb07.png', thumbnail: '/assets/aistudio/image_731dbb07.png',
    titleI18n: { en: 'Community Mobilization & Event Sound Truck Broadcast', am: 'የማህበረሰብ ቅስቀሳ እና የድምፅ ማጉያ መኪና ጉዞ', om: 'Kakasa Hawaasaa fi Sagantaa Beeksisa Magaalaa' },
    captionI18n: { en: 'Sanitation squad and organizers gathered with the event broadcast vehicle to coordinate town-wide activities.', am: 'የበዓሉ አስተባባሪዎች የድምፅ ማጉያ መኪና በማዘጋጀት የወሊሶን ማህበረሰብ ሲያስተባብሩ።', om: 'Konkolaataa beeksisaa fi sagaleedhaan hawaasa dammaqsuun hirmaachisuu.' },
  },
  {
    id: 'gal-13', year: 2024, category: 'culture', mediaType: 'image',
    url: '/assets/aistudio/image_1a90f9a9.png', thumbnail: '/assets/aistudio/image_1a90f9a9.png',
    titleI18n: { en: 'Traditional Oromo Cavalry Procession (Abba Gadaa Escort)', am: 'የፈረሰኞች የክብር ሰልፍ በወሊሶ አውራ ጎዳና', om: 'Goolii Fardeen Aadaa Oromoo Daandii Walisoo Irratti' },
    captionI18n: { en: 'Vibrant traditional horsemen dressed in ceremonial white and traditional headdresses leading the opening festival.', am: 'በነጭ ባህላዊ ልብስ ያጌጡ ፈረሰኞች የወሊሶ ከተማን ዋና ጎዳና ሲያደምቁ።', om: 'Abbootii fardaa uffata adii fi faaya aadaa uffatanii daandii irratti.' },
  },
  {
    id: 'gal-14', year: 2024, category: 'culture', mediaType: 'image',
    url: '/assets/aistudio/image_6eb824fd.png', thumbnail: '/assets/aistudio/image_6eb824fd.png',
    titleI18n: { en: 'Heritage Costume Poses & Student Fellowship', am: 'የተማሪዎች የወዳጅነት ፎቶ በባህላዊ አልባሳት', om: 'Suuraa Hiriyyummaa Barattootaa Uffata Aadaatiin' },
    captionI18n: { en: 'Students proudly displaying authentic handwoven dresses, embroidered scarves, and cultural jewelry in the garden grounds.', am: 'ተማሪዎች በተለያዩ ውብ የሀበሻ እና የኦሮሞ ባህላዊ አልባሳት አጊጠው።', om: 'Barattoonni uffata aadaa Itoophiyaa adda addaatiin miidhaganii.' },
  },
  {
    id: 'gal-15', year: 2024, category: 'culture', mediaType: 'image',
    url: '/assets/aistudio/image_c7963080.png', thumbnail: '/assets/aistudio/image_c7963080.png',
    titleI18n: { en: 'National Unity Cultural Representatives', am: 'የብሔራዊ አንድነት የባህል ልኡካን ተማሪዎች', om: 'Bakka-buutota Aadaa Tokkummaa Biyyooleessaa' },
    captionI18n: { en: 'Diverse student delegates posing together under Ethiopian flags in celebration of inter-cultural understanding.', am: 'የተለያዩ ብሔር ብሔረሰቦችን ባህል የሚወክሉ ተማሪዎች በሰንደቅ ዓላማ ስር አብረው።', om: 'Barattoonni saboota hundaa bakka bu\'an alaabaa jalatti tokkummaadhaan.' },
  },
  {
    id: 'gal-16', year: 2024, category: 'culture', mediaType: 'image',
    url: '/assets/aistudio/image_b3b470e9.png', thumbnail: '/assets/aistudio/image_b3b470e9.png',
    titleI18n: { en: 'Grand Lineup of Ethiopian Cultural Attires', am: 'የተማሪዎች ረጅም የባህላዊ አልባሳት ሰልፍ', om: 'Hiriira Dheeraa Uffata Aadaa Barattootaa' },
    captionI18n: { en: 'Panoramic lineup displaying dozens of authentic regional dresses along the palm-lined campus avenue.', am: 'በካምፓሱ ዛፎች ጥላ ስር የተሰለፉ በርካታ ተማሪዎች በባህላዊ አልባሳት።', om: 'Hiriira bal\'aa barattootaa uffata aadaa miidhagaadhaan daandii irratti.' },
  },
  {
    id: 'gal-17', year: 2024, category: 'culture', mediaType: 'image',
    url: '/assets/aistudio/image_dd2f8daf.png', thumbnail: '/assets/aistudio/image_dd2f8daf.png',
    titleI18n: { en: 'Traditional Shamma & Tibeb White Robe Delegation', am: 'የነጭ ሻማ እና ጥበብ አልባሳት የባህል ልዑክ', om: 'Uffata Aadaa Shammaa fi Xibabii Adii' },
    captionI18n: { en: 'Young men showcasing pure white cotton handwoven kuta and shamma with red and black geometric border embroidery.', am: 'ወጣቶች ነጭ ጥበብ የተጠለፈባቸው ባህላዊ የሀገር ልብሶችን ለብሰው።', om: 'Dargaggoonni uffata aadaa xibabii qabuun kabajaa agarsiisan.' },
  },
];

export const Gallery: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language as Language) || 'en';
  const { data: galleryFromSnapshot, isLoading } = useGallery();

  const hardcodedIds = new Set(HARDCODED_GALLERY.map((g) => g.id));
  const dbItems = (galleryFromSnapshot ?? []).filter((g) => !hardcodedIds.has(g.id));
  const gallery: GalleryItem[] = [...HARDCODED_GALLERY, ...dbItems];
  const { data: gallerySection } = useSection('home.gallery');

  const reg = getSectionEntry('home.gallery');
  const badge   = gallerySection?.subtitleI18n?.[currentLang] ?? gallerySection?.subtitleI18n?.en
    ?? reg?.defaultContent?.subtitle?.[currentLang] ?? reg?.defaultContent?.subtitle?.en
    ?? 'Visual Archive';
  const heading = gallerySection?.titleI18n?.[currentLang] ?? gallerySection?.titleI18n?.en
    ?? reg?.defaultContent?.title?.[currentLang] ?? reg?.defaultContent?.title?.en
    ?? t('gallery.title');

  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [activeIndex,      setActiveIndex]      = React.useState<number | null>(null);

  /* ── Touch swipe tracking ── */
  const touchStartX = React.useRef<number>(0);
  const touchStartY = React.useRef<number>(0);

  const categories = [
    { key: 'all',         label: t('gallery.allCategories') },
    { key: 'culture',     label: t('events.culture')        },
    { key: 'sports',      label: t('events.sports')         },
    { key: 'academic',    label: t('events.academic')       },
    { key: 'competition', label: t('events.competition')    },
    { key: 'community',   label: t('events.community')      },
  ];

  const filteredItems = gallery.filter(
    (item) => selectedCategory === 'all' || item.category === selectedCategory,
  );

  const activeMedia = activeIndex !== null ? filteredItems[activeIndex] ?? null : null;
  const hasPrev = activeIndex !== null && activeIndex > 0;
  const hasNext = activeIndex !== null && activeIndex < filteredItems.length - 1;

  const closeModal  = React.useCallback(() => setActiveIndex(null), []);
  const goNext      = React.useCallback(() => setActiveIndex((i) => (i !== null && i < filteredItems.length - 1 ? i + 1 : i)), [filteredItems.length]);
  const goPrev      = React.useCallback(() => setActiveIndex((i) => (i !== null && i > 0 ? i - 1 : i)), []);

  /* ── Keyboard nav + Escape ── */
  React.useEffect(() => {
    if (activeIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     closeModal();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft')  goPrev();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [activeIndex, closeModal, goNext, goPrev]);

  /* ── Body scroll lock when lightbox open ── */
  React.useEffect(() => {
    if (activeIndex !== null) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [activeIndex]);

  /* ── Touch swipe handlers ── */
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) goNext();
      else        goPrev();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-8">

      {/* Header */}
      <div className="border-b border-stone-200 dark:border-stone-800 pb-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#0F3D2E] dark:text-[#D9A441] mb-2 uppercase tracking-wider">
          <Camera className="h-4 w-4" aria-hidden="true" />
          <span>{badge}</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-stone-900 dark:text-stone-100">
          {heading}
        </h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 max-w-2xl">
          {t('gallery.subtitle')}
        </p>
      </div>

      {/* Filter Tabs — horizontally scrollable on phones */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar -mx-4 sm:mx-0 px-4 sm:px-0">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                isActive
                  ? 'bg-[#0F3D2E] text-white dark:bg-[#D9A441] dark:text-[#0A2A20] shadow-xs'
                  : 'bg-white dark:bg-[#12221C] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 hover:border-stone-400'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Gallery Grid — 2 cols on phones, 3 on sm+, 4 on lg+ */}
      {filteredItems.length === 0 ? (
        <EmptyState title={t('gallery.noMedia')} description="Select another category tab." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {filteredItems.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className="group rounded-2xl overflow-hidden bg-white dark:bg-[#12221C] border border-stone-200 dark:border-stone-800 hover:shadow-xl transition-all text-left focus-visible:outline-2 focus-visible:outline-[#D9A441] focus-visible:outline-offset-2"
              aria-label={`View photo: ${item.titleI18n[currentLang] ?? item.titleI18n.en}`}
            >
              {/* Fixed aspect ratio so there's no layout shift */}
              <div className="relative aspect-square overflow-hidden bg-stone-900">
                {(() => { const ri = resolveImage((item as GalleryItem & { thumbUrl?: string }).thumbUrl ?? item.thumbnail ?? item.url); return (
                <img
                  src={ri.src}
                  srcSet={ri.srcSet || undefined}
                  sizes={ri.srcSet ? '(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw' : undefined}
                  alt={item.titleI18n[currentLang] || item.titleI18n.en}
                  loading="lazy"
                  decoding="async"
                  width={400}
                  height={400}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                />); })()}
                <div className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-xs text-white border border-white/20">
                  {item.year}
                </div>
                <div className="absolute top-2 left-2 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-[#0F3D2E]/90 text-[#D9A441]">
                  {item.category}
                </div>
              </div>
              <div className="p-3 space-y-1">
                <h3 className="font-display font-bold text-xs text-stone-900 dark:text-stone-100 group-hover:text-[#0F3D2E] dark:group-hover:text-[#D9A441] transition-colors leading-snug line-clamp-2">
                  {item.titleI18n[currentLang] || item.titleI18n.en}
                </h3>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Full-screen lightbox ── */}
      {activeMedia && activeIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activeMedia.titleI18n[currentLang] ?? activeMedia.titleI18n.en}
          className="fixed inset-0 z-50 bg-black flex flex-col"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={closeModal}
        >
          {/* Top bar: caption + close — tappable above browser chrome */}
          <div
            className="relative z-10 flex items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top,12px),12px)] pb-3 bg-black/70 backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#D9A441] uppercase tracking-wider truncate">
                {activeMedia.category} · {activeMedia.year}
              </p>
              <p className="text-sm font-semibold text-white leading-snug line-clamp-1">
                {activeMedia.titleI18n[currentLang] ?? activeMedia.titleI18n.en}
              </p>
            </div>
            <button
              type="button"
              onClick={closeModal}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors shrink-0"
              aria-label="Close photo viewer"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Image — fills remaining height, touch-action allows pinch zoom */}
          <div
            className="flex-1 flex items-center justify-center overflow-hidden"
            style={{ touchAction: 'pinch-zoom' }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => { const ri = resolveImage(activeMedia.url); return (
            <img
              src={ri.src}
              srcSet={ri.srcSet || undefined}
              sizes={ri.srcSet ? '100vw' : undefined}
              alt={activeMedia.titleI18n[currentLang] || activeMedia.titleI18n.en}
              className="max-w-full max-h-full object-contain"
              style={{ userSelect: 'none' }}
              draggable={false}
            />); })()}
          </div>

          {/* Bottom bar: caption + prev/next — above safe area */}
          <div
            className="relative z-10 flex items-end justify-between gap-3 px-4 pt-3 pb-[max(env(safe-area-inset-bottom,12px),12px)] bg-black/70 backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Caption */}
            <div className="min-w-0 flex-1">
              {activeMedia.captionI18n && (
                <p className="text-xs text-stone-300 leading-relaxed line-clamp-2">
                  {activeMedia.captionI18n[currentLang] ?? activeMedia.captionI18n.en}
                </p>
              )}
              <p className="text-[10px] text-stone-500 mt-1">
                {activeIndex + 1} / {filteredItems.length}
              </p>
            </div>

            {/* Prev / Next */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={goPrev}
                disabled={!hasPrev}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white disabled:opacity-30 transition-colors"
                aria-label="Previous photo"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!hasNext}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white disabled:opacity-30 transition-colors"
                aria-label="Next photo"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

