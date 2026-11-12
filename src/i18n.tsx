// Interface language. It follows the document's writing direction: an RTL
// script gets the Persian interface, an LTR script the English one. English is
// the default, so components rendered without a provider stay English.
import { createContext, useContext, type ReactNode } from 'react'
import type { Direction, ElementType } from './core/types'

export type Lang = 'en' | 'fa'

export function langFor(direction: Direction): Lang {
  return direction === 'rtl' ? 'fa' : 'en'
}

const en = {
  'app.untitled': 'Untitled screenplay',
  'app.projects': 'projects',
  'app.titleInput': 'screenplay title',
  'menu.newScreenplay': 'New screenplay',
  'menu.rename': 'Rename',
  'menu.export': 'Export',
  'menu.remove': 'Remove project',

  'el.scene': 'Scene Heading',
  'el.action': 'Action',
  'el.character': 'Character',
  'el.parenthetical': 'Parenthetical',
  'el.dialogue': 'Dialogue',
  'el.transition': 'Transition',

  'toolbar.elementType': 'element type',
  'toolbar.generate': 'Generate',
  'toolbar.breakdown': 'Breakdown',
  'toolbar.focus': 'Focus',
  'toolbar.exitFocus': 'Exit focus',
  'toolbar.save': 'Save',

  'status.words': '{n} words',
  'status.storageError': 'unsaved — storage error',
  'status.toFa': 'فارسی',
  'status.toEn': 'English',
  'status.toFaLabel': 'switch writing direction to right-to-left (Persian)',
  'status.toEnLabel': 'switch writing direction to left-to-right (English)',
  'status.toDark': 'Switch to dark mode',
  'status.toLight': 'Switch to light mode',
  'status.aiSettings': 'Open AI settings',
  'status.aiSettingsTitle': 'AI settings',

  'editor.placeholder': 'Start writing — Ctrl/Cmd+1 picks the element type',
  'editor.genericError': 'Something went wrong',

  'rewrite.menu': 'rewrite selection',
  'rewrite.Polish': 'Polish',
  'rewrite.Shorten': 'Shorten',
  'rewrite.Expand': 'Expand',
  'rewrite.custom': 'Custom instruction',
  'rewrite.customLabel': 'custom instruction',
  'rewrite.pending': 'Rewriting…',

  'ai.dialog': 'AI settings',
  'ai.close': 'close settings',
  'ai.title': 'AI',
  'ai.provider': 'Provider',
  'ai.endpoint': 'Endpoint',
  'ai.endpointLabel': 'endpoint',
  'ai.model': 'Model',
  'ai.modelLabel': 'model',
  'ai.chooseModel': 'choose a model…',
  'ai.modelId': 'model id',
  'ai.listFail': "Couldn't list models — type the model id, or refresh once the server is up.",
  'ai.apiKey': 'API key',
  'ai.apiKeyLabel': 'api key',
  'ai.servicePassword': 'Service password',
  'ai.servicePasswordLabel': 'service password',
  'ai.opencodeHint': '← run `opencode service status` (or read ~/.config/opencode/service.json) and paste the password once.',
  'ai.testing': 'Testing…',
  'ai.test': 'Test connection',
  'ai.refresh': 'Refresh models',
  'ai.works': 'Works',
  'ai.save': 'Save',

  'bd.dialog': 'script breakdown',
  'bd.close': 'close breakdown',
  'bd.title': 'Breakdown',
  'bd.noProvider': 'No provider configured. Open AI settings to pick a model.',
  'bd.openSettings': 'Open settings',
  'bd.reading': 'Reading the script…',
  'bd.willAppear': 'Logline, characters, locations and scenes will appear here.',
  'bd.retry': 'Retry',
  'bd.characters': 'Characters',
  'bd.locations': 'Locations',
  'bd.scenes': 'Scenes',
  'bd.intro': 'Sends the whole script to {model}. A rerun costs another request.',
  'bd.run': 'Run breakdown',
  'bd.truncated': 'Script truncated after {kept} of {total} blocks.',

  'gen.dialog': 'generate screenplay',
  'gen.close': 'close generate',
  'gen.title': 'Generate',
  'gen.noteAppend': 'Appends the new chapter to the open screenplay, continuing after its last scene.',
  'gen.noteNew': 'Creates a new screenplay: title, characters, and a fully written first chapter of scenes.',
  'gen.continue': 'Continue current screenplay',
  'gen.continueLabel': 'continue current screenplay',
  'gen.idea': 'Idea',
  'gen.ideaLabel': 'idea',
  'gen.ideaPlaceholder': 'A lighthouse keeper finds a mermaid tangled in his nets…',
  'gen.genre': 'Genre (optional)',
  'gen.genreLabel': 'genre',
  'gen.genrePlaceholder': 'noir, comedy, …',
  'gen.writing': 'Writing…',
  'gen.run': 'Generate',
  'gen.summary': '{characters} characters, {scenes} scenes',
  'gen.append': 'Append chapter',
  'gen.openNew': 'Open as new project',
  'toolbar.assist': 'Assistant',
  'as.dialog': 'writing assistant',
  'as.close': 'close assistant',
  'as.title': 'Assistant',
  'as.where': 'Working from: {scene}',
  'as.whereStart': 'the start of the script',
  'as.next': 'What happens next?',
  'as.scene': 'Ideas for this scene',
  'as.fill': 'Fill the gap',
  'as.noteLabel': 'question or note',
  'as.notePlaceholder': 'Ask anything, or add a note for the ideas — e.g. “she is lying to him”',
  'as.ask': 'Ask',
  'as.thinking': 'Thinking…',
  'as.writeThis': 'Write this',
  'as.insert': 'Insert at cursor',
  'as.again': 'Try again',
  'as.hint': 'Put the cursor where you are stuck, then pick an option.',
}

export type StringKey = keyof typeof en

const fa: Record<StringKey, string> = {
  'app.untitled': 'فیلم‌نامه‌ی بی‌نام',
  'app.projects': 'پروژه‌ها',
  'app.titleInput': 'عنوان فیلم‌نامه',
  'menu.newScreenplay': 'فیلم‌نامه‌ی جدید',
  'menu.rename': 'تغییر نام',
  'menu.export': 'خروجی',
  'menu.remove': 'حذف پروژه',

  'el.scene': 'سرصحنه',
  'el.action': 'شرح صحنه',
  'el.character': 'شخصیت',
  'el.parenthetical': 'توضیح',
  'el.dialogue': 'دیالوگ',
  'el.transition': 'انتقال',

  'toolbar.elementType': 'نوع عنصر',
  'toolbar.generate': 'نوشتن با هوش مصنوعی',
  'toolbar.breakdown': 'تحلیل فیلم‌نامه',
  'toolbar.focus': 'تمرکز',
  'toolbar.exitFocus': 'خروج از تمرکز',
  'toolbar.save': 'ذخیره',

  'status.words': '{n} کلمه',
  'status.storageError': 'ذخیره نشد — خطای حافظه',
  'status.toFa': 'فارسی',
  'status.toEn': 'English',
  'status.toFaLabel': 'تغییر جهت نوشتن به راست‌به‌چپ (فارسی)',
  'status.toEnLabel': 'تغییر جهت نوشتن به چپ‌به‌راست (انگلیسی)',
  'status.toDark': 'حالت تیره',
  'status.toLight': 'حالت روشن',
  'status.aiSettings': 'باز کردن تنظیمات هوش مصنوعی',
  'status.aiSettingsTitle': 'تنظیمات هوش مصنوعی',

  'editor.placeholder': 'نوشتن را شروع کنید — Ctrl/Cmd+1 نوع عنصر را انتخاب می‌کند',
  'editor.genericError': 'مشکلی پیش آمد',

  'rewrite.menu': 'بازنویسی متن انتخاب‌شده',
  'rewrite.Polish': 'صیقل',
  'rewrite.Shorten': 'کوتاه‌تر',
  'rewrite.Expand': 'بلندتر',
  'rewrite.custom': 'دستور دلخواه',
  'rewrite.customLabel': 'دستور دلخواه',
  'rewrite.pending': 'در حال بازنویسی…',

  'ai.dialog': 'تنظیمات هوش مصنوعی',
  'ai.close': 'بستن تنظیمات',
  'ai.title': 'هوش مصنوعی',
  'ai.provider': 'سرویس',
  'ai.endpoint': 'نشانی سرویس',
  'ai.endpointLabel': 'نشانی سرویس',
  'ai.model': 'مدل',
  'ai.modelLabel': 'مدل',
  'ai.chooseModel': 'یک مدل انتخاب کنید…',
  'ai.modelId': 'شناسه‌ی مدل',
  'ai.listFail': 'فهرست مدل‌ها دریافت نشد — شناسه‌ی مدل را بنویسید، یا وقتی سرور روشن شد دوباره امتحان کنید.',
  'ai.apiKey': 'کلید API',
  'ai.apiKeyLabel': 'کلید API',
  'ai.servicePassword': 'رمز سرویس',
  'ai.servicePasswordLabel': 'رمز سرویس',
  'ai.opencodeHint': '← دستور `opencode service status` را اجرا کنید (یا ~/.config/opencode/service.json را بخوانید) و رمز را یک بار این‌جا بگذارید.',
  'ai.testing': 'در حال آزمایش…',
  'ai.test': 'آزمایش اتصال',
  'ai.refresh': 'تازه‌سازی مدل‌ها',
  'ai.works': 'کار می‌کند',
  'ai.save': 'ذخیره',

  'bd.dialog': 'تحلیل فیلم‌نامه',
  'bd.close': 'بستن تحلیل',
  'bd.title': 'تحلیل فیلم‌نامه',
  'bd.noProvider': 'سرویسی تنظیم نشده است. برای انتخاب مدل، تنظیمات هوش مصنوعی را باز کنید.',
  'bd.openSettings': 'باز کردن تنظیمات',
  'bd.reading': 'در حال خواندن فیلم‌نامه…',
  'bd.willAppear': 'خلاصه‌ی داستان، شخصیت‌ها، مکان‌ها و صحنه‌ها این‌جا نمایش داده می‌شوند.',
  'bd.retry': 'تلاش دوباره',
  'bd.characters': 'شخصیت‌ها',
  'bd.locations': 'مکان‌ها',
  'bd.scenes': 'صحنه‌ها',
  'bd.intro': 'کل فیلم‌نامه برای {model} فرستاده می‌شود. هر بار اجرا یک درخواست جدید است.',
  'bd.run': 'شروع تحلیل',
  'bd.truncated': 'فیلم‌نامه پس از {kept} از {total} بلوک کوتاه شد.',

  'gen.dialog': 'نوشتن فیلم‌نامه',
  'gen.close': 'بستن',
  'gen.title': 'نوشتن با هوش مصنوعی',
  'gen.noteAppend': 'فصل تازه بعد از آخرین صحنه‌ی فیلم‌نامه‌ی باز اضافه می‌شود.',
  'gen.noteNew': 'یک فیلم‌نامه‌ی تازه می‌سازد: عنوان، شخصیت‌ها و فصل اول با صحنه‌های کامل.',
  'gen.continue': 'ادامه‌ی فیلم‌نامه‌ی فعلی',
  'gen.continueLabel': 'ادامه‌ی فیلم‌نامه‌ی فعلی',
  'gen.idea': 'ایده',
  'gen.ideaLabel': 'ایده',
  'gen.ideaPlaceholder': 'نگهبان یک فانوس دریایی، پری دریایی‌ای را در تورش پیدا می‌کند…',
  'gen.genre': 'ژانر (اختیاری)',
  'gen.genreLabel': 'ژانر',
  'gen.genrePlaceholder': 'نوآر، کمدی، …',
  'gen.writing': 'در حال نوشتن…',
  'gen.run': 'بنویس',
  'gen.summary': '{characters} شخصیت، {scenes} صحنه',
  'gen.append': 'افزودن فصل',
  'gen.openNew': 'باز کردن به‌عنوان پروژه‌ی تازه',
  'toolbar.assist': 'دستیار',
  'as.dialog': 'دستیار نویسنده',
  'as.close': 'بستن دستیار',
  'as.title': 'دستیار نویسنده',
  'as.where': 'بر اساس: {scene}',
  'as.whereStart': 'آغاز فیلم‌نامه',
  'as.next': 'بعدش چه می‌شود؟',
  'as.scene': 'ایده برای این صحنه',
  'as.fill': 'جای خالی را پر کن',
  'as.noteLabel': 'سؤال یا توضیح',
  'as.notePlaceholder': 'هر سؤالی دارید بپرسید، یا برای ایده‌ها توضیحی بنویسید — مثلاً «او به رضا دروغ می‌گوید»',
  'as.ask': 'بپرس',
  'as.thinking': 'در حال فکر کردن…',
  'as.writeThis': 'همین را بنویس',
  'as.insert': 'افزودن در جای مکان‌نما',
  'as.again': 'دوباره',
  'as.hint': 'مکان‌نما را جایی بگذارید که گیر کرده‌اید، بعد یکی از گزینه‌ها را انتخاب کنید.',
}

const STRINGS: Record<Lang, Record<StringKey, string>> = { en, fa }

const faDigits = new Intl.NumberFormat('fa-IR', { useGrouping: false })

function formatValue(lang: Lang, value: string | number): string {
  return typeof value === 'number' && lang === 'fa' ? faDigits.format(value) : String(value)
}

export function translate(lang: Lang, key: StringKey, vars?: Record<string, string | number>): string {
  const template = STRINGS[lang][key]
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? formatValue(lang, vars[name]) : match,
  )
}

export function elementLabel(lang: Lang, type: ElementType): string {
  return STRINGS[lang][`el.${type}` as StringKey]
}

const LangContext = createContext<Lang>('en')

export function LangProvider(props: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={props.lang}>{props.children}</LangContext.Provider>
}

export function useLang(): Lang {
  return useContext(LangContext)
}

export function useT() {
  const lang = useContext(LangContext)
  return (key: StringKey, vars?: Record<string, string | number>) => translate(lang, key, vars)
}
