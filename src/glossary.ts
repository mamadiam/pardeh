// Screenwriting terms in both interface languages, written for this app.
import type { Lang } from './i18n'

export interface GlossaryEntry {
  term: Record<Lang, string>
  definition: Record<Lang, string>
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: { en: 'Scene heading (slugline)', fa: 'سرصحنه' },
    definition: {
      en: 'The line that opens a scene: inside or outside (INT. / EXT.), the place, and the time of day. Example: INT. CAFÉ – NIGHT.',
      fa: 'خطی که هر صحنه با آن شروع می‌شود: داخلی یا خارجی، مکان، و زمان. مثال: داخلی. کافه — شب.',
    },
  },
  {
    term: { en: 'Action', fa: 'شرح صحنه' },
    definition: {
      en: 'What we see and hear on screen, written in the present tense. Only what a camera could show.',
      fa: 'آنچه روی پرده دیده و شنیده می‌شود، در زمان حال. فقط چیزی که دوربین می‌تواند نشان دهد.',
    },
  },
  {
    term: { en: 'Character cue', fa: 'نام شخصیت' },
    definition: {
      en: 'The name of the speaker, above their dialogue. Written in capitals in English scripts.',
      fa: 'نام کسی که حرف می‌زند، بالای دیالوگ او. در فیلم‌نامه‌ی فارسی معمولاً پررنگ نوشته می‌شود.',
    },
  },
  {
    term: { en: 'Parenthetical', fa: 'توضیح (پرانتز)' },
    definition: {
      en: 'A short note in brackets under the character name: how a line is said, or a small action. Use sparingly.',
      fa: 'یادداشتی کوتاه داخل پرانتز زیر نام شخصیت: لحن گفتن یا یک حرکت کوچک. کم استفاده کنید.',
    },
  },
  {
    term: { en: 'Dialogue', fa: 'دیالوگ' },
    definition: {
      en: 'What a character says. Good dialogue sounds natural and carries subtext.',
      fa: 'آنچه شخصیت می‌گوید. دیالوگ خوب طبیعی است و زیرمتن دارد.',
    },
  },
  {
    term: { en: 'Transition', fa: 'انتقال' },
    definition: {
      en: 'How one scene passes to the next, such as CUT TO: or FADE OUT. Modern scripts use few.',
      fa: 'شیوه‌ی رفتن از یک صحنه به صحنه‌ی بعد، مثل «برش به:» یا «محو به سیاهی». فیلم‌نامه‌های امروزی کم از آن استفاده می‌کنند.',
    },
  },
  {
    term: { en: 'Voice-over (V.O.)', fa: 'صدای روی تصویر' },
    definition: {
      en: 'Words heard over the picture from someone who is not in the scene, such as a narrator or a remembered voice.',
      fa: 'صدایی که روی تصویر شنیده می‌شود از کسی که در صحنه نیست، مثل راوی یا صدایی از خاطره.',
    },
  },
  {
    term: { en: 'Off-screen (O.S.)', fa: 'خارج از قاب' },
    definition: {
      en: 'A character who is in the scene, or right next to it, but outside what the camera shows, such as a voice from the next room.',
      fa: 'شخصیتی که در صحنه یا همان نزدیکی هست ولی دوربین او را نشان نمی‌دهد، مثل صدایی از اتاق کناری.',
    },
  },
  {
    term: { en: "(CONT'D) and (MORE)", fa: '(ادامه) و (بیشتر)' },
    definition: {
      en: "(CONT'D) marks a character continuing to speak after an interruption; (MORE) marks dialogue that continues on the next page.",
      fa: '(ادامه) یعنی شخصیت پس از یک وقفه به حرفش ادامه می‌دهد؛ (بیشتر) یعنی دیالوگ در صفحه‌ی بعد ادامه دارد.',
    },
  },
  {
    term: { en: 'Logline', fa: 'خلاصه‌ی یک‌خطی' },
    definition: {
      en: 'The whole story in one or two sentences: who the hero is, what they want, and what stands in the way.',
      fa: 'کل داستان در یک یا دو جمله: قهرمان کیست، چه می‌خواهد، و چه چیزی سر راهش است.',
    },
  },
  {
    term: { en: 'Beat', fa: 'بیت (لحظه‌ی داستانی)' },
    definition: {
      en: 'A single story moment where something changes. Also a short pause in dialogue.',
      fa: 'یک لحظه‌ی داستانی که در آن چیزی تغییر می‌کند. همچنین یک مکث کوتاه در دیالوگ.',
    },
  },
  {
    term: { en: 'Outline / beat sheet', fa: 'طرح کلی / فهرست بیت‌ها' },
    definition: {
      en: 'The story broken into its beats or scenes, in order, before writing the pages.',
      fa: 'داستان، تقسیم‌شده به بیت‌ها یا صحنه‌ها به ترتیب، پیش از نوشتن متن کامل.',
    },
  },
  {
    term: { en: 'Inciting incident', fa: 'حادثه‌ی محرک' },
    definition: {
      en: "The event that knocks the hero's life off balance and starts the story moving.",
      fa: 'رویدادی که زندگی قهرمان را از تعادل خارج می‌کند و داستان را به حرکت درمی‌آورد.',
    },
  },
  {
    term: { en: 'Act', fa: 'پرده' },
    definition: {
      en: 'A large section of the story. Most films use three acts: setup, confrontation, resolution.',
      fa: 'بخشی بزرگ از داستان. بیشتر فیلم‌ها سه پرده دارند: معرفی، کشمکش، گره‌گشایی.',
    },
  },
  {
    term: { en: 'Midpoint', fa: 'نقطه‌ی میانی' },
    definition: {
      en: 'The turn in the middle of the story that raises the stakes or changes the hero’s goal.',
      fa: 'چرخشی در میانه‌ی داستان که خطر را بیشتر می‌کند یا هدف قهرمان را تغییر می‌دهد.',
    },
  },
  {
    term: { en: 'Climax', fa: 'اوج' },
    definition: {
      en: 'The final, biggest confrontation, where the central conflict is decided.',
      fa: 'آخرین و بزرگ‌ترین رویارویی، جایی که کشمکش اصلی تعیین تکلیف می‌شود.',
    },
  },
  {
    term: { en: 'Subtext', fa: 'زیرمتن' },
    definition: {
      en: 'What characters mean or feel but do not say outright.',
      fa: 'آنچه شخصیت‌ها منظور دارند یا حس می‌کنند ولی مستقیم نمی‌گویند.',
    },
  },
  {
    term: { en: 'Montage', fa: 'مونتاژ' },
    definition: {
      en: 'A series of short shots that compress time or show a process.',
      fa: 'مجموعه‌ای از نماهای کوتاه که گذر زمان یا یک روند را فشرده نشان می‌دهد.',
    },
  },
  {
    term: { en: 'Intercut', fa: 'برش موازی' },
    definition: {
      en: 'Cutting back and forth between two places, such as both ends of a phone call.',
      fa: 'رفت‌وبرگشت میان دو مکان، مثل دو طرف یک تماس تلفنی.',
    },
  },
  {
    term: { en: 'Coverage', fa: 'گزارش ارزیابی' },
    definition: {
      en: 'A reader’s report on a script: summary, strengths, weaknesses, and a verdict (Pass, Consider, Recommend).',
      fa: 'گزارش یک خواننده‌ی حرفه‌ای درباره‌ی فیلم‌نامه: خلاصه، نقاط قوت و ضعف، و نتیجه (رد، قابل بررسی، توصیه‌شده).',
    },
  },
  {
    term: { en: 'Page count', fa: 'تعداد صفحه' },
    definition: {
      en: 'One properly formatted page is about one minute of screen time; a feature is usually 90 to 120 pages.',
      fa: 'هر صفحه‌ی استاندارد حدود یک دقیقه روی پرده است؛ فیلم بلند معمولاً ۹۰ تا ۱۲۰ صفحه است.',
    },
  },
]

export function searchGlossary(query: string, lang: Lang): GlossaryEntry[] {
  const q = query.trim().toLowerCase()
  if (q === '') return GLOSSARY
  return GLOSSARY.filter((e) =>
    [e.term.en, e.term.fa, e.definition[lang]].some((s) => s.toLowerCase().includes(q)),
  )
}
