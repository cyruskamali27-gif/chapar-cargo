export type LangCode = 'fa' | 'en' | 'tr' | 'ar' | 'fr' | 'zh';

export const RTL_LANGS: LangCode[] = ['fa', 'ar'];

export const langMeta: { code: LangCode; name: string; nativeName: string }[] = [
  { code: 'fa', name: 'Persian',  nativeName: 'فارسی' },
  { code: 'en', name: 'English',  nativeName: 'English' },
  { code: 'tr', name: 'Turkish',  nativeName: 'Türkçe' },
  { code: 'ar', name: 'Arabic',   nativeName: 'العربية' },
  { code: 'fr', name: 'French',   nativeName: 'Français' },
  { code: 'zh', name: 'Chinese',  nativeName: '中文' },
];

export interface Translations {
  headline: string;
  subheadline: string;
  buyForMe: string;
  sendPackage: string;
  becomeTraveler: string;
  escrowProtected: string;
  aiVerified: string;
  globalNetwork: string;
  countries190: string;
  marketplace: string;
  security: string;
  investors: string;
  faq: string;
  signIn: string;
  getStarted: string;
  howItWorks: string;
  globalRoutes: string;
  liveActivity: string;
  trustSafety: string;
  app: string;
  buyForMeTitle: string;
  buyForMeDesc: string;
  sendPackageTitle: string;
  sendPackageDesc: string;
  travelerTitle: string;
  travelerDesc: string;
  marketplaceTitle: string;
  trustSafetyTitle: string;
  investorsTitle: string;
  faqTitle: string;
  joinNetwork: string;
  backHome: string;
  step1Title: string;
  step1Desc: string;
  step2Title: string;
  step2Desc: string;
  step3Title: string;
  step3Desc: string;

  // BuyForMePage
  bfmFormTitle: string;
  bfmProductLabel: string;
  bfmProductPlaceholder: string;
  bfmBuyFromLabel: string;
  bfmBuyFromPlaceholder: string;
  bfmDeliverToLabel: string;
  bfmDeliverToPlaceholder: string;
  bfmBudgetLabel: string;
  bfmNotesLabel: string;
  bfmNotesPlaceholder: string;
  bfmFindTraveler: string;
  bfmHowTitle: string;
  bfmHowStep1Title: string;
  bfmHowStep1Desc: string;
  bfmHowStep2Title: string;
  bfmHowStep2Desc: string;
  bfmHowStep3Title: string;
  bfmHowStep3Desc: string;
  bfmHowStep4Title: string;
  bfmHowStep4Desc: string;
  bfmCostTitle: string;
  bfmCostProduct: string;
  bfmCostTravelerFee: string;
  bfmCostPlatform: string;
  bfmCostInsurance: string;
  bfmCostIncluded: string;
  bfmCostTotal: string;

  // SendPackagePage
  spFormTitle: string;
  spFromLabel: string;
  spFromPlaceholder: string;
  spToLabel: string;
  spToPlaceholder: string;
  spWeightLabel: string;
  spValueLabel: string;
  spDeadlineLabel: string;
  spDescLabel: string;
  spDescPlaceholder: string;
  spServiceTierLabel: string;
  spTierStandard: string;
  spTierExpress: string;
  spTierSameDay: string;
  spDays57: string;
  spDays23: string;
  sp24Hours: string;
  spPostPackage: string;
  spWhyTitle: string;
  spBenefit1Val: string;
  spBenefit1Lbl: string;
  spBenefit2Val: string;
  spBenefit2Lbl: string;
  spBenefit3Val: string;
  spBenefit3Lbl: string;
  spBenefit4Val: string;
  spBenefit4Lbl: string;
  spSuccessRate: string;
  spDeliveries: string;

  // TravelerPage
  travHowTitle: string;
  travStep1Title: string;
  travStep1Desc: string;
  travStep2Title: string;
  travStep2Desc: string;
  travStep3Title: string;
  travStep3Desc: string;
  travStep4Title: string;
  travStep4Desc: string;
  travStep5Title: string;
  travStep5Desc: string;
  travCalcTitle: string;
  travLuggageLabel: string;
  travEstPerTrip: string;
  travAvgPricing: string;
  travMonthly: string;
  travAnnually: string;
  travReqTitle: string;
  travReq1: string;
  travReq2: string;
  travReq3: string;
  travReq4: string;
  travReq5: string;
  travRegister: string;

  // MarketplacePage
  mktBrowseDesc: string;
  mktAllRoutes: string;
  mktToTehran: string;
  mktToDubai: string;
  mktToLondon: string;
  mktToNewYork: string;
  mktToToronto: string;
  mktLoadMore: string;

  // TrustSafetyPage
  tsDesc: string;
  tsSecurityLayers: string;
  tsSoc2Desc: string;
  tsIsoDesc: string;
  tsPciDesc: string;
  tsGdprDesc: string;
  tsCertified: string;
  tsCompliant: string;
  tsVerifiedBadge: string;
  tsEscrowTitle: string;
  tsEscrowDesc: string;
  tsAiTitle: string;
  tsAi1Title: string;
  tsAi1Desc: string;
  tsAi2Title: string;
  tsAi2Desc: string;
  tsAi3Title: string;
  tsAi3Desc: string;
  tsAi4Title: string;
  tsAi4Desc: string;
  tsAi5Title: string;
  tsAi5Desc: string;

  // InvestorsPage
  invDesc: string;
  invNetworkUsers: string;
  invCountries: string;
  invTAM: string;
  invRevenueGrowth: string;
  invGlobalCoverage: string;
  invExpandingMarket: string;
  invYearOverYear: string;
  invYoY127: string;
  invProblemTitle: string;
  invProblemDesc: string;
  invSolutionTitle: string;
  invSolutionDesc: string;
  invTractionTitle: string;
  invTractionDesc: string;
  invCtaTitle: string;
  invCtaDesc: string;
  invCtaButton: string;

  // FAQPage
  faqDesc: string;
  faqQ1: string;
  faqA1: string;
  faqQ2: string;
  faqA2: string;
  faqQ3: string;
  faqA3: string;
  faqQ4: string;
  faqA4: string;
  faqQ5: string;
  faqA5: string;
  faqQ6: string;
  faqA6: string;
  faqQ7: string;
  faqA7: string;
  faqQ8: string;
  faqA8: string;
  heroCta1: string;
  heroCta2: string;
  heroCta3: string;
}

export const translations: Record<LangCode, Translations> = {
  fa: {
    headline: 'زیرساخت اعتماد جهانی برای تجارت بدون مرز',
    subheadline: 'خرید، ارسال و تحویل کالا در سراسر جهان با مسافران تأییدشده، پرداخت امانی و هوش مصنوعی.',
    buyForMe: 'خرید برای من',
    sendPackage: 'ارسال کالا',
    becomeTraveler: 'مسافر شوید',
    escrowProtected: 'پرداخت امانی',
    aiVerified: 'تأیید با هوش مصنوعی',
    globalNetwork: 'شبکه جهانی',
    countries190: 'بیش از ۱۹۰ کشور',
    marketplace: 'بازارگاه',
    security: 'امنیت',
    investors: 'سرمایه‌گذاران',
    faq: 'سوالات متداول',
    signIn: 'ورود',
    getStarted: 'شروع کنید',
    howItWorks: 'چگونه کار می‌کند',
    globalRoutes: 'مسیرهای جهانی',
    liveActivity: 'فعالیت زنده',
    trustSafety: 'اعتماد و امنیت',
    app: 'اپلیکیشن',
    buyForMeTitle: 'خرید برای من',
    buyForMeDesc: 'محصولات مورد نظر خود را از هر جای دنیا سفارش دهید',
    sendPackageTitle: 'ارسال کالا',
    sendPackageDesc: 'بسته‌های خود را با مسافران تأییدشده ارسال کنید',
    travelerTitle: 'مسافر شوید',
    travelerDesc: 'در سفرهایتان درآمد کسب کنید',
    marketplaceTitle: 'بازارگاه مسیرها',
    trustSafetyTitle: 'اعتماد و امنیت',
    investorsTitle: 'فرصت سرمایه‌گذاری',
    faqTitle: 'سوالات متداول',
    joinNetwork: 'به شبکه بپیوندید',
    backHome: 'بازگشت به خانه',
    step1Title: 'ایجاد سفارش',
    step1Desc: 'جزئیات بسته، مقصد و زمان‌بندی خود را وارد کنید. قیمت‌گذاری با هوش مصنوعی.',
    step2Title: 'تطبیق مسافر',
    step2Desc: 'هوش مصنوعی ما به طور فوری شما را با مسافران تأییدشده که به مقصدتان می‌روند مطابقت می‌دهد.',
    step3Title: 'تحویل امن',
    step3Desc: 'ردیابی در زمان واقعی. پرداخت فقط پس از تأیید تحویل آزاد می‌شود.',

    // BuyForMePage
    bfmFormTitle: 'چه چیزی می‌خواهید بخرید؟',
    bfmProductLabel: 'نام محصول / لینک',
    bfmProductPlaceholder: 'مثلاً iPhone 15 Pro یا لینک را وارد کنید',
    bfmBuyFromLabel: 'خرید از (کشور)',
    bfmBuyFromPlaceholder: 'مثلاً ایالات متحده',
    bfmDeliverToLabel: 'تحویل به',
    bfmDeliverToPlaceholder: 'مثلاً تهران، ایران',
    bfmBudgetLabel: 'حداکثر بودجه (دلار)',
    bfmNotesLabel: 'توضیحات اضافه',
    bfmNotesPlaceholder: 'سایز، رنگ، مدل خاص...',
    bfmFindTraveler: 'پیدا کردن مسافر',
    bfmHowTitle: 'خرید برای من چگونه کار می‌کند',
    bfmHowStep1Title: 'بگویید چه می‌خواهید',
    bfmHowStep1Desc: 'لینک محصول را به اشتراک بگذارید یا آنچه از هر کشوری نیاز دارید را توصیف کنید.',
    bfmHowStep2Title: 'با مسافر مطابقت پیدا کنید',
    bfmHowStep2Desc: 'ما یک مسافر تأییدشده که از آن کشور به شهر شما می‌رود پیدا می‌کنیم.',
    bfmHowStep3Title: 'پرداخت امانی امن',
    bfmHowStep3Desc: 'وجه شما به صورت امن نگه داشته می‌شود تا زمانی که کالا به شما تحویل داده شود.',
    bfmHowStep4Title: 'کالای خود را دریافت کنید',
    bfmHowStep4Desc: 'تحویل را تأیید کنید و وجه آزاد شود. ساده، امن، سریع.',
    bfmCostTitle: 'تخمین هزینه',
    bfmCostProduct: 'قیمت محصول',
    bfmCostTravelerFee: 'کارمزد مسافر (۸٪)',
    bfmCostPlatform: 'کارمزد پلتفرم',
    bfmCostInsurance: 'بیمه',
    bfmCostIncluded: 'شامل است',
    bfmCostTotal: 'مجموع تخمینی',

    // SendPackagePage
    spFormTitle: 'مشخصات بسته',
    spFromLabel: 'از',
    spFromPlaceholder: 'شهر مبدأ',
    spToLabel: 'به',
    spToPlaceholder: 'شهر مقصد',
    spWeightLabel: 'وزن (کیلوگرم)',
    spValueLabel: 'ارزش (دلار)',
    spDeadlineLabel: 'مهلت',
    spDescLabel: 'توضیح محتویات',
    spDescPlaceholder: 'محتویات بسته خود را توضیح دهید...',
    spServiceTierLabel: 'سطح سرویس',
    spTierStandard: 'عادی',
    spTierExpress: 'اکسپرس',
    spTierSameDay: 'همان روز',
    spDays57: '۵–۷ روز',
    spDays23: '۲–۳ روز',
    sp24Hours: '۲۴ ساعت',
    spPostPackage: 'ثبت بسته',
    spWhyTitle: 'چرا با چاپار ارسال کنید؟',
    spBenefit1Val: '۶۰٪ ارزان‌تر',
    spBenefit1Lbl: 'در مقابل شرکت‌های حمل‌ونقل سنتی',
    spBenefit2Val: 'میانگین ۲–۴ روز',
    spBenefit2Lbl: 'زمان تحویل',
    spBenefit3Val: 'بیمه ۱۰ هزار دلاری',
    spBenefit3Lbl: 'برای هر بسته',
    spBenefit4Val: 'ردیابی زنده',
    spBenefit4Lbl: 'بروزرسانی GPS',
    spSuccessRate: 'نرخ موفقیت',
    spDeliveries: 'بیش از ۱۲.۵ میلیون تحویل',

    // TravelerPage
    travHowTitle: 'چگونه مسافر چاپار شوید',
    travStep1Title: 'پروفایل خود را بسازید',
    travStep1Desc: 'ثبت‌نام کنید و پروفایل مسافر خود را با تاریخچه سفر تکمیل کنید.',
    travStep2Title: 'تأیید هویت',
    travStep2Desc: 'پاسپورت یا کارت شناسایی خود را آپلود کنید. تأیید هوش مصنوعی کمتر از ۵ دقیقه طول می‌کشد.',
    travStep3Title: 'مسیر خود را اضافه کنید',
    travStep3Desc: 'تاریخ پرواز، مبدأ و شهر مقصد خود را به ما بگویید.',
    travStep4Title: 'بسته‌ها را قبول کنید',
    travStep4Desc: 'درخواست‌های بسته در مسیر خود را مرور کنید و آنهایی که دوست دارید را قبول کنید.',
    travStep5Title: 'تحویل دهید و درآمد کسب کنید',
    travStep5Desc: 'بسته را تحویل دهید و پس از تأیید، پرداخت فوری دریافت کنید.',
    travCalcTitle: 'ماشین حساب درآمد',
    travLuggageLabel: 'فضای چمدان موجود (کیلوگرم):',
    travEstPerTrip: 'تخمین درآمد هر سفر',
    travAvgPricing: 'بر اساس میانگین قیمت مسیرها',
    travMonthly: 'ماهانه (۲ سفر)',
    travAnnually: 'سالانه (۲۴ سفر)',
    travReqTitle: 'شرایط مسافر',
    travReq1: 'پاسپورت معتبر',
    travReq2: 'سن ۱۸ سال به بالا',
    travReq3: 'سابقه کیفری پاک',
    travReq4: 'هویت تأییدشده',
    travReq5: 'قبول شرایط خدمات',
    travRegister: 'ثبت‌نام به عنوان مسافر',

    // MarketplacePage
    mktBrowseDesc: 'مسیرهای فعال با مسافران موجود را مرور کنید',
    mktAllRoutes: 'همه مسیرها',
    mktToTehran: 'به تهران',
    mktToDubai: 'به دبی',
    mktToLondon: 'به لندن',
    mktToNewYork: 'به نیویورک',
    mktToToronto: 'به تورنتو',
    mktLoadMore: 'نمایش مسیرهای بیشتر',

    // TrustSafetyPage
    tsDesc: 'چگونه هر تراکنش را ایمن نگه می‌داریم',
    tsSecurityLayers: 'لایه‌های امنیتی',
    tsSoc2Desc: 'ممیزی سالانه توسط طرف ثالث',
    tsIsoDesc: 'مدیریت امنیت اطلاعات',
    tsPciDesc: 'بالاترین سطح امنیت پرداخت',
    tsGdprDesc: 'رعایت کامل قوانین حفاظت از داده',
    tsCertified: 'گواهی‌شده',
    tsCompliant: 'منطبق',
    tsVerifiedBadge: 'تأییدشده',
    tsEscrowTitle: 'سیستم پرداخت امانی',
    tsEscrowDesc: 'هر تراکنش توسط سیستم امانی بانکی ما محافظت می‌شود. وجوه هرگز خزانه امن ما را ترک نمی‌کنند تا زمانی که هر دو طرف تحویل موفق را تأیید کنند.',
    tsAiTitle: 'تأیید هوش مصنوعی',
    tsAi1Title: 'تأیید هویت',
    tsAi1Desc: 'شناسنامه دولتی + تشخیص چهره با تشخیص زنده بودن.',
    tsAi2Title: 'بررسی سابقه',
    tsAi2Desc: 'بررسی خودکار در پایگاه‌های داده بین‌المللی.',
    tsAi3Title: 'تحلیل رفتاری',
    tsAi3Desc: 'نظارت مداوم هوش مصنوعی الگوهای مشکوک را شناسایی می‌کند.',
    tsAi4Title: 'اسکن بسته',
    tsAi4Desc: 'تحلیل تصویر با هوش مصنوعی برای اقلام ممنوعه.',
    tsAi5Title: 'تشخیص تقلب ۲۴/۷',
    tsAi5Desc: 'نظارت بلادرنگ تراکنش‌ها با هشدارهای فوری.',

    // InvestorsPage
    invDesc: 'به انقلاب تجارت فرامرزی بپیوندید',
    invNetworkUsers: 'کاربران شبکه',
    invCountries: 'کشور',
    invTAM: 'بازار هدف کل',
    invRevenueGrowth: 'رشد درآمد',
    invGlobalCoverage: 'پوشش جهانی',
    invExpandingMarket: 'بازار در حال گسترش',
    invYearOverYear: 'سال به سال',
    invYoY127: '+۱۲۷٪ سال به سال',
    invProblemTitle: 'مشکل',
    invProblemDesc: 'حمل‌ونقل سنتی برای ۴۰٪ از مسیرهای جهانی کند، گران و غیرقابل دسترس است. تجارت الکترونیک فرامرزی سالانه ۲۵٪ رشد می‌کند اما لجستیک تکامل نیافته است.',
    invSolutionTitle: 'راه‌حل',
    invSolutionDesc: 'چاپار از ۱.۴ میلیارد مسافر سالانه برای ایجاد شبکه تحویل همتا به همتا جهانی استفاده می‌کند. ۳–۵ برابر سریع‌تر، ۶۰٪ ارزان‌تر، با حفاظت کامل امانی و بیمه.',
    invTractionTitle: 'پیشرفت',
    invTractionDesc: '۵۰ میلیون کاربر، بیش از ۱۰۰ میلیون دلار GMV، رشد ۲۱۵٪ سال به سال. فعال در ۱۹۰ کشور با نرخ موفقیت ۹۹.۹٪. حمایت‌شده توسط Sequoia، a16z و Tiger Global.',
    invCtaTitle: 'علاقه‌مند به سرمایه‌گذاری هستید؟',
    invCtaDesc: 'در حال حاضر در حال جمع‌آوری سری B هستیم. با تیم روابط سرمایه‌گذاران ما تماس بگیرید.',
    invCtaButton: 'تماس با روابط سرمایه‌گذاران',

    // FAQPage
    faqDesc: 'هر آنچه باید درباره چاپار بدانید',
    faqQ1: 'حفاظت امانی چگونه کار می‌کند؟',
    faqA1: 'وقتی یک سفارش ایجاد می‌کنید، پرداخت به صورت امن در حساب امانی رمزنگاری‌شده ما نگه داشته می‌شود. وجوه فقط پس از تأیید تحویل موفق به مسافر آزاد می‌شود. در صورت بروز هرگونه اختلاف، تیم حل‌وفصل ما بررسی می‌کند و نتایج منصفانه برای هر دو طرف با حفاظت کامل استرداد وجه تضمین می‌کند.',
    faqQ2: 'مسافران چگونه تأیید می‌شوند؟',
    faqA2: 'هر مسافر تأیید هویت جامع شامل شناسنامه دولتی، تأیید پاسپورت، بررسی سابقه و تشخیص چهره را طی می‌کند. آن‌ها باید حداقل رتبه ۴.۵ ستاره را حفظ کنند و ما از تشخیص تقلب مبتنی بر هوش مصنوعی با نظارت مستمر استفاده می‌کنیم.',
    faqQ3: 'چه اقلامی می‌توانم از طریق چاپار ارسال کنم؟',
    faqA3: 'می‌توانید اکثر اقلام شخصی، اسناد، وسایل الکترونیکی، هدایا و محصولات تجاری کوچک زیر ۱۵ کیلوگرم ارسال کنید. اقلام ممنوعه شامل مواد خطرناک، مواد مخدر، سلاح، حیوانات زنده، مواد فاسدشدنی و اقلام نیازمند مجوز خاص می‌شود.',
    faqQ4: 'اگر بسته‌ام نرسد چه اتفاقی می‌افتد؟',
    faqA4: 'هر سفارش شامل پوشش بیمه خودکار تا ۱۰,۰۰۰ دلار بدون هزینه اضافی است. اگر تحویل در بازه زمانی توافق‌شده تأیید نشود، استرداد کامل وجه به علاوه ادعای بیمه برای ارزش اعلام‌شده دریافت می‌کنید. تیم پشتیبانی ۲۴/۷ ما مشکلات را در ۴۸ ساعت حل می‌کند.',
    faqQ5: 'به عنوان مسافر چقدر می‌توانم درآمد داشته باشم؟',
    faqA5: 'درآمد بر اساس مسیر، اندازه بسته، فوریت تحویل و مقصد متفاوت است. اکثر مسافران ۵۰–۳۰۰ دلار برای هر تحویل درآمد کسب می‌کنند و پردرآمدترین‌ها سالانه بیش از ۱۵,۰۰۰ دلار درآمد دارند. نرخ خود را تعیین کنید و بسته‌هایی که قبول می‌کنید را انتخاب کنید.',
    faqQ6: 'آیا چاپار در کشور من موجود است؟',
    faqA6: 'بله! چاپار در بیش از ۱۹۰ کشور در تمام قاره‌ها با مسیرهای فعال که ۹۵٪ جمعیت جهانی را پوشش می‌دهد فعالیت می‌کند. سیستم تطبیق هوش مصنوعی ما حتی در مکان‌های دورافتاده هم بهترین مسیرها را پیدا می‌کند.',
    faqQ7: 'تطبیق هوش مصنوعی چگونه کار می‌کند؟',
    faqA7: 'هوش مصنوعی اختصاصی ما هزاران نقطه داده — محبوبیت مسیر، رتبه‌بندی مسافران، نیازهای بسته، زمان‌بندی و قیمت‌گذاری — را تحلیل می‌کند تا بهترین تطابق را برای هر درخواست سفارش فوری پیدا کند.',
    faqQ8: 'آیا اطلاعات پرداختم امن است؟',
    faqA8: 'کاملاً. ما از پردازش پرداخت مطابق PCI DSS سطح ۱، رمزنگاری AES-256 استفاده می‌کنیم و هرگز شماره کارت کامل ذخیره نمی‌کنیم. تمام تراکنش‌ها از طریق سیستم امانی رمزنگاری‌شده ما انجام می‌شود.',
    heroCta1: 'ثبت خرید',
    heroCta2: 'ثبت مسیر مسافر',
    heroCta3: 'ارسال کالا',
  },

  en: {
    headline: 'Global Trust Infrastructure for Borderless Commerce',
    subheadline: 'Buy, send, and deliver goods worldwide with verified travelers, escrow payments, and AI.',
    buyForMe: 'Buy For Me',
    sendPackage: 'Send Package',
    becomeTraveler: 'Become a Traveler',
    escrowProtected: 'Escrow Protected',
    aiVerified: 'AI Verified',
    globalNetwork: 'Global Network',
    countries190: '190+ Countries',
    marketplace: 'Marketplace',
    security: 'Security',
    investors: 'Investors',
    faq: 'FAQ',
    signIn: 'Sign In',
    getStarted: 'Get Started',
    howItWorks: 'How It Works',
    globalRoutes: 'Global Routes',
    liveActivity: 'Live Activity',
    trustSafety: 'Trust & Safety',
    app: 'App',
    buyForMeTitle: 'Buy For Me',
    buyForMeDesc: 'Order products from anywhere in the world',
    sendPackageTitle: 'Send Package',
    sendPackageDesc: 'Ship your packages with verified travelers',
    travelerTitle: 'Become a Traveler',
    travelerDesc: 'Earn money on your trips',
    marketplaceTitle: 'Route Marketplace',
    trustSafetyTitle: 'Trust & Safety',
    investorsTitle: 'Investment Opportunity',
    faqTitle: 'Frequently Asked Questions',
    joinNetwork: 'Join The Network',
    backHome: 'Back to Home',
    step1Title: 'Create Shipment',
    step1Desc: 'Post your package details, destination, and timeline. AI-powered pricing.',
    step2Title: 'Match Traveler',
    step2Desc: 'Our AI instantly matches you with verified travelers heading to your destination.',
    step3Title: 'Secure Delivery',
    step3Desc: 'Track in real-time. Payment releases only after confirmed delivery.',

    // BuyForMePage
    bfmFormTitle: 'What would you like to buy?',
    bfmProductLabel: 'Product Name / URL',
    bfmProductPlaceholder: 'e.g. iPhone 15 Pro or paste URL',
    bfmBuyFromLabel: 'Buy From (Country)',
    bfmBuyFromPlaceholder: 'e.g. United States',
    bfmDeliverToLabel: 'Deliver To',
    bfmDeliverToPlaceholder: 'e.g. Tehran, Iran',
    bfmBudgetLabel: 'Max Budget (USD)',
    bfmNotesLabel: 'Additional Notes',
    bfmNotesPlaceholder: 'Size, color, specific model...',
    bfmFindTraveler: 'Find a Traveler',
    bfmHowTitle: 'How Buy For Me Works',
    bfmHowStep1Title: 'Tell us what you want',
    bfmHowStep1Desc: 'Share the product URL or describe what you need from any country.',
    bfmHowStep2Title: 'Match with a traveler',
    bfmHowStep2Desc: 'We find a verified traveler heading from that country to your city.',
    bfmHowStep3Title: 'Secure escrow payment',
    bfmHowStep3Desc: 'Your funds are held safely until the item is delivered to you.',
    bfmHowStep4Title: 'Receive your item',
    bfmHowStep4Desc: 'Confirm delivery and funds are released. Simple, safe, fast.',
    bfmCostTitle: 'Estimated Cost Breakdown',
    bfmCostProduct: 'Product Price',
    bfmCostTravelerFee: 'Traveler Fee (8%)',
    bfmCostPlatform: 'Platform Fee',
    bfmCostInsurance: 'Insurance',
    bfmCostIncluded: 'Included',
    bfmCostTotal: 'Total Estimate',

    // SendPackagePage
    spFormTitle: 'Package Details',
    spFromLabel: 'From',
    spFromPlaceholder: 'Origin city',
    spToLabel: 'To',
    spToPlaceholder: 'Destination city',
    spWeightLabel: 'Weight (kg)',
    spValueLabel: 'Value (USD)',
    spDeadlineLabel: 'Deadline',
    spDescLabel: 'Item Description',
    spDescPlaceholder: 'Describe your package contents...',
    spServiceTierLabel: 'Service Tier',
    spTierStandard: 'Standard',
    spTierExpress: 'Express',
    spTierSameDay: 'Same Day',
    spDays57: '5–7 days',
    spDays23: '2–3 days',
    sp24Hours: '24 hours',
    spPostPackage: 'Post Package',
    spWhyTitle: 'Why send with Chapar?',
    spBenefit1Val: '60% cheaper',
    spBenefit1Lbl: 'vs traditional carriers',
    spBenefit2Val: '2–4 days avg',
    spBenefit2Lbl: 'delivery time',
    spBenefit3Val: '$10K insurance',
    spBenefit3Lbl: 'per package',
    spBenefit4Val: 'Real-time tracking',
    spBenefit4Lbl: 'GPS updates',
    spSuccessRate: 'Success Rate',
    spDeliveries: 'Over 12.5M deliveries',

    // TravelerPage
    travHowTitle: 'How to become a Chapar traveler',
    travStep1Title: 'Create your profile',
    travStep1Desc: 'Sign up and complete your traveler profile with travel history.',
    travStep2Title: 'Identity verification',
    travStep2Desc: 'Upload your passport/ID. AI verification takes under 5 minutes.',
    travStep3Title: 'Add your route',
    travStep3Desc: 'Tell us your flight date, origin, and destination city.',
    travStep4Title: 'Accept packages',
    travStep4Desc: 'Browse package requests on your route and accept ones you like.',
    travStep5Title: 'Deliver & earn',
    travStep5Desc: 'Hand off the package and receive instant payment after confirmation.',
    travCalcTitle: 'Earnings Calculator',
    travLuggageLabel: 'Available luggage space (kg):',
    travEstPerTrip: 'Estimated per trip',
    travAvgPricing: 'Based on average route pricing',
    travMonthly: 'Monthly (2 trips)',
    travAnnually: 'Annually (24 trips)',
    travReqTitle: 'Traveler Requirements',
    travReq1: 'Valid passport',
    travReq2: 'Age 18+',
    travReq3: 'Clean background check',
    travReq4: 'Verified identity',
    travReq5: 'Accept terms of service',
    travRegister: 'Register as Traveler',

    // MarketplacePage
    mktBrowseDesc: 'Browse active routes with available travelers',
    mktAllRoutes: 'All Routes',
    mktToTehran: 'To Tehran',
    mktToDubai: 'To Dubai',
    mktToLondon: 'To London',
    mktToNewYork: 'To New York',
    mktToToronto: 'To Toronto',
    mktLoadMore: 'Load More Routes',

    // TrustSafetyPage
    tsDesc: 'How we keep every transaction safe',
    tsSecurityLayers: 'Security Layers',
    tsSoc2Desc: 'Annual audits by third-party',
    tsIsoDesc: 'Information security management',
    tsPciDesc: 'Highest level of payment security',
    tsGdprDesc: 'Full data protection compliance',
    tsCertified: 'Certified',
    tsCompliant: 'Compliant',
    tsVerifiedBadge: 'Verified',
    tsEscrowTitle: 'Escrow Payment System',
    tsEscrowDesc: 'Every transaction is protected by our bank-grade escrow. Funds never leave our secure vault until both parties confirm successful delivery.',
    tsAiTitle: 'AI Verification',
    tsAi1Title: 'Identity Verification',
    tsAi1Desc: 'Government ID + facial recognition with liveness detection.',
    tsAi2Title: 'Background Checks',
    tsAi2Desc: 'Automated checks across international databases.',
    tsAi3Title: 'Behavioral Analysis',
    tsAi3Desc: 'Continuous AI monitoring flags suspicious patterns.',
    tsAi4Title: 'Package Scanning',
    tsAi4Desc: 'AI-powered image analysis for prohibited items.',
    tsAi5Title: '24/7 Fraud Detection',
    tsAi5Desc: 'Real-time transaction monitoring with instant alerts.',

    // InvestorsPage
    invDesc: 'Join the cross-border commerce revolution',
    invNetworkUsers: 'Network Users',
    invCountries: 'Countries',
    invTAM: 'TAM',
    invRevenueGrowth: 'Revenue Growth',
    invGlobalCoverage: 'Global Coverage',
    invExpandingMarket: 'Expanding Market',
    invYearOverYear: 'Year over Year',
    invYoY127: '+127% YoY',
    invProblemTitle: 'Problem',
    invProblemDesc: 'Traditional shipping is slow, expensive, and inaccessible for 40% of global routes. Cross-border e-commerce is growing 25% annually but logistics hasn\'t evolved.',
    invSolutionTitle: 'Solution',
    invSolutionDesc: 'Chapar leverages 1.4B annual travelers to create a global peer-to-peer delivery network. 3–5x faster, 60% cheaper, with full escrow protection and insurance.',
    invTractionTitle: 'Traction',
    invTractionDesc: '50M users, $100M+ GMV, 215% YoY growth. Active in 190 countries with 99.9% success rate. Backed by Sequoia, a16z, and Tiger Global.',
    invCtaTitle: 'Interested in investing?',
    invCtaDesc: 'We\'re currently raising our Series B. Get in touch with our investor relations team.',
    invCtaButton: 'Contact Investor Relations',

    // FAQPage
    faqDesc: 'Everything you need to know about Chapar',
    faqQ1: 'How does the escrow protection work?',
    faqA1: 'When you create a shipment, payment is securely held in our encrypted escrow account. Funds are only released to the traveler after you confirm successful delivery. If there\'s any dispute, our resolution team investigates and ensures fair outcomes for both parties with full refund protection.',
    faqQ2: 'How are travelers verified?',
    faqA2: 'Every traveler undergoes comprehensive identity verification including government ID, passport verification, background checks, and facial recognition. They must maintain a minimum 4.5-star rating and we use AI-powered fraud detection with continuous monitoring.',
    faqQ3: 'What items can I send through Chapar?',
    faqA3: 'You can send most personal items, documents, electronics, gifts, and small business products under 15kg. Prohibited items include hazardous materials, illegal substances, weapons, live animals, perishables, and items requiring special permits.',
    faqQ4: 'What happens if my package doesn\'t arrive?',
    faqA4: 'Every shipment includes automatic insurance coverage up to $10,000 at no extra cost. If delivery isn\'t confirmed within the agreed timeframe, you receive a full refund plus insurance claim for the declared value. Our 24/7 support team resolves issues within 48 hours.',
    faqQ5: 'How much can I earn as a traveler?',
    faqA5: 'Earnings vary by route, package size, delivery urgency, and destination. Most travelers earn $50–$300 per delivery, with top earners making over $15,000 annually. You set your own rates and choose which packages to accept.',
    faqQ6: 'Is Chapar available in my country?',
    faqA6: 'Yes! Chapar operates in 190+ countries across all continents with active routes covering 95% of the global population. Our AI matching system finds optimal routes even in remote locations.',
    faqQ7: 'How does AI matching work?',
    faqA7: 'Our proprietary AI analyzes thousands of data points — route popularity, traveler ratings, package requirements, timing, and pricing — to instantly find the best match for every shipment request.',
    faqQ8: 'Is my payment information secure?',
    faqA8: 'Absolutely. We use PCI DSS Level 1 compliant payment processing, AES-256 encryption, and never store full card numbers. All transactions go through our encrypted escrow system.',
    heroCta1: 'Post a Request',
    heroCta2: 'Register as Traveler',
    heroCta3: 'Send a Package',
  },

  tr: {
    headline: 'Sınırsız Ticaret İçin Küresel Güven Altyapısı',
    subheadline: 'Dünya genelinde doğrulanmış yolcular, emanet ödemeler ve yapay zeka ile mal satın alın, gönderin ve teslim edin.',
    buyForMe: 'Benim İçin Al',
    sendPackage: 'Paket Gönder',
    becomeTraveler: 'Yolcu Ol',
    escrowProtected: 'Emanet Korumalı',
    aiVerified: 'Yapay Zeka Doğrulandı',
    globalNetwork: 'Küresel Ağ',
    countries190: '190+ Ülke',
    marketplace: 'Pazar Yeri',
    security: 'Güvenlik',
    investors: 'Yatırımcılar',
    faq: 'SSS',
    signIn: 'Giriş Yap',
    getStarted: 'Başla',
    howItWorks: 'Nasıl Çalışır',
    globalRoutes: 'Küresel Rotalar',
    liveActivity: 'Canlı Aktivite',
    trustSafety: 'Güven ve Güvenlik',
    app: 'Uygulama',
    buyForMeTitle: 'Benim İçin Al',
    buyForMeDesc: 'Dünyanın herhangi bir yerinden ürün sipariş edin',
    sendPackageTitle: 'Paket Gönder',
    sendPackageDesc: 'Paketlerinizi doğrulanmış yolcularla gönderin',
    travelerTitle: 'Yolcu Ol',
    travelerDesc: 'Seyahatlerinizde para kazanın',
    marketplaceTitle: 'Rota Pazarı',
    trustSafetyTitle: 'Güven ve Güvenlik',
    investorsTitle: 'Yatırım Fırsatı',
    faqTitle: 'Sıkça Sorulan Sorular',
    joinNetwork: 'Ağa Katıl',
    backHome: 'Ana Sayfaya Dön',
    step1Title: 'Gönderi Oluştur',
    step1Desc: 'Paket bilgilerinizi, varış noktanızı ve zaman çizelgenizi girin.',
    step2Title: 'Yolcu Eşleştir',
    step2Desc: 'Yapay zekamız sizi anında doğrulanmış yolcularla eşleştirir.',
    step3Title: 'Güvenli Teslimat',
    step3Desc: 'Gerçek zamanlı takip. Ödeme yalnızca teslim onayından sonra serbest bırakılır.',

    // BuyForMePage
    bfmFormTitle: 'Ne satın almak istersiniz?',
    bfmProductLabel: 'Ürün Adı / URL',
    bfmProductPlaceholder: 'ör. iPhone 15 Pro veya URL yapıştırın',
    bfmBuyFromLabel: 'Nereden Alınsın (Ülke)',
    bfmBuyFromPlaceholder: 'ör. Amerika Birleşik Devletleri',
    bfmDeliverToLabel: 'Nereye Teslim Edilsin',
    bfmDeliverToPlaceholder: 'ör. Tahran, İran',
    bfmBudgetLabel: 'Maksimum Bütçe (USD)',
    bfmNotesLabel: 'Ek Notlar',
    bfmNotesPlaceholder: 'Boyut, renk, belirli model...',
    bfmFindTraveler: 'Yolcu Bul',
    bfmHowTitle: 'Benim İçin Al Nasıl Çalışır',
    bfmHowStep1Title: 'Ne istediğinizi söyleyin',
    bfmHowStep1Desc: 'Ürün URL\'sini paylaşın veya herhangi bir ülkeden neye ihtiyacınız olduğunu açıklayın.',
    bfmHowStep2Title: 'Bir yolcuyla eşleşin',
    bfmHowStep2Desc: 'O ülkeden şehrinize giden doğrulanmış bir yolcu buluyoruz.',
    bfmHowStep3Title: 'Güvenli emanet ödemesi',
    bfmHowStep3Desc: 'Ürün size teslim edilene kadar fonlarınız güvenle tutulur.',
    bfmHowStep4Title: 'Ürününüzü alın',
    bfmHowStep4Desc: 'Teslimatı onaylayın ve fonlar serbest bırakılır. Basit, güvenli, hızlı.',
    bfmCostTitle: 'Tahmini Maliyet Dökümü',
    bfmCostProduct: 'Ürün Fiyatı',
    bfmCostTravelerFee: 'Yolcu Ücreti (%8)',
    bfmCostPlatform: 'Platform Ücreti',
    bfmCostInsurance: 'Sigorta',
    bfmCostIncluded: 'Dahil',
    bfmCostTotal: 'Toplam Tahmin',

    // SendPackagePage
    spFormTitle: 'Paket Detayları',
    spFromLabel: 'Nereden',
    spFromPlaceholder: 'Kaynak şehir',
    spToLabel: 'Nereye',
    spToPlaceholder: 'Hedef şehir',
    spWeightLabel: 'Ağırlık (kg)',
    spValueLabel: 'Değer (USD)',
    spDeadlineLabel: 'Son Tarih',
    spDescLabel: 'Ürün Açıklaması',
    spDescPlaceholder: 'Paket içeriğinizi açıklayın...',
    spServiceTierLabel: 'Hizmet Seviyesi',
    spTierStandard: 'Standart',
    spTierExpress: 'Ekspres',
    spTierSameDay: 'Aynı Gün',
    spDays57: '5–7 gün',
    spDays23: '2–3 gün',
    sp24Hours: '24 saat',
    spPostPackage: 'Paketi Yayınla',
    spWhyTitle: 'Neden Chapar ile gönderin?',
    spBenefit1Val: '%60 daha ucuz',
    spBenefit1Lbl: 'geleneksel taşıyıcılara göre',
    spBenefit2Val: 'ort. 2–4 gün',
    spBenefit2Lbl: 'teslimat süresi',
    spBenefit3Val: '$10K sigorta',
    spBenefit3Lbl: 'paket başına',
    spBenefit4Val: 'Gerçek zamanlı takip',
    spBenefit4Lbl: 'GPS güncellemeleri',
    spSuccessRate: 'Başarı Oranı',
    spDeliveries: '12,5 milyondan fazla teslimat',

    // TravelerPage
    travHowTitle: 'Chapar yolcusu nasıl olunur',
    travStep1Title: 'Profilinizi oluşturun',
    travStep1Desc: 'Kaydolun ve yolcu profilinizi seyahat geçmişiyle tamamlayın.',
    travStep2Title: 'Kimlik doğrulama',
    travStep2Desc: 'Pasaportunuzu/kimliğinizi yükleyin. Yapay zeka doğrulaması 5 dakikadan az sürer.',
    travStep3Title: 'Rotanızı ekleyin',
    travStep3Desc: 'Uçuş tarihinizi, kalkış ve varış şehrinizi bize bildirin.',
    travStep4Title: 'Paketleri kabul edin',
    travStep4Desc: 'Rotanızdaki paket taleplerini inceleyin ve beğendiklerinizi kabul edin.',
    travStep5Title: 'Teslim edin ve kazanın',
    travStep5Desc: 'Paketi teslim edin ve onaydan sonra anında ödeme alın.',
    travCalcTitle: 'Kazanç Hesaplayıcı',
    travLuggageLabel: 'Kullanılabilir bagaj alanı (kg):',
    travEstPerTrip: 'Seyahat başına tahmini kazanç',
    travAvgPricing: 'Ortalama rota fiyatlandırmasına göre',
    travMonthly: 'Aylık (2 seyahat)',
    travAnnually: 'Yıllık (24 seyahat)',
    travReqTitle: 'Yolcu Gereksinimleri',
    travReq1: 'Geçerli pasaport',
    travReq2: '18 yaş ve üzeri',
    travReq3: 'Temiz sabıka kaydı',
    travReq4: 'Doğrulanmış kimlik',
    travReq5: 'Hizmet şartlarını kabul et',
    travRegister: 'Yolcu Olarak Kayıt Ol',

    // MarketplacePage
    mktBrowseDesc: 'Müsait yolcularla aktif rotaları keşfedin',
    mktAllRoutes: 'Tüm Rotalar',
    mktToTehran: 'Tahran\'a',
    mktToDubai: 'Dubai\'ye',
    mktToLondon: 'Londra\'ya',
    mktToNewYork: 'New York\'a',
    mktToToronto: 'Toronto\'ya',
    mktLoadMore: 'Daha Fazla Rota Yükle',

    // TrustSafetyPage
    tsDesc: 'Her işlemi nasıl güvende tutuyoruz',
    tsSecurityLayers: 'Güvenlik Katmanları',
    tsSoc2Desc: 'Üçüncü taraf tarafından yıllık denetimler',
    tsIsoDesc: 'Bilgi güvenliği yönetimi',
    tsPciDesc: 'En yüksek ödeme güvenliği seviyesi',
    tsGdprDesc: 'Tam veri koruma uyumluluğu',
    tsCertified: 'Sertifikalı',
    tsCompliant: 'Uyumlu',
    tsVerifiedBadge: 'Doğrulandı',
    tsEscrowTitle: 'Emanet Ödeme Sistemi',
    tsEscrowDesc: 'Her işlem banka düzeyinde emanet sistemimizle korunur. Her iki taraf da başarılı teslimatı onaylayana kadar fonlar güvenli kasemizden çıkmaz.',
    tsAiTitle: 'Yapay Zeka Doğrulaması',
    tsAi1Title: 'Kimlik Doğrulama',
    tsAi1Desc: 'Canlılık tespitli devlet kimliği + yüz tanıma.',
    tsAi2Title: 'Sabıka Kaydı Kontrolü',
    tsAi2Desc: 'Uluslararası veri tabanlarında otomatik kontroller.',
    tsAi3Title: 'Davranışsal Analiz',
    tsAi3Desc: 'Sürekli yapay zeka izlemesi şüpheli kalıpları işaretler.',
    tsAi4Title: 'Paket Tarama',
    tsAi4Desc: 'Yasaklı ürünler için yapay zeka destekli görüntü analizi.',
    tsAi5Title: '7/24 Dolandırıcılık Tespiti',
    tsAi5Desc: 'Anlık uyarılarla gerçek zamanlı işlem izleme.',

    // InvestorsPage
    invDesc: 'Sınır ötesi ticaret devrimine katılın',
    invNetworkUsers: 'Ağ Kullanıcıları',
    invCountries: 'Ülkeler',
    invTAM: 'TAM',
    invRevenueGrowth: 'Gelir Büyümesi',
    invGlobalCoverage: 'Küresel Kapsam',
    invExpandingMarket: 'Genişleyen Pazar',
    invYearOverYear: 'Yıldan Yıla',
    invYoY127: '+%127 Yıllık',
    invProblemTitle: 'Sorun',
    invProblemDesc: 'Geleneksel kargo, küresel rotaların %40\'ı için yavaş, pahalı ve erişilemezdir. Sınır ötesi e-ticaret yıllık %25 büyüyor ancak lojistik gelişmedi.',
    invSolutionTitle: 'Çözüm',
    invSolutionDesc: 'Chapar, küresel bir eşten eşe teslimat ağı oluşturmak için yılda 1,4 milyar gezginden yararlanır. 3–5 kat daha hızlı, %60 daha ucuz, tam emanet koruması ve sigortayla.',
    invTractionTitle: 'İlerleme',
    invTractionDesc: '50 milyon kullanıcı, 100 milyon dolar+ GMV, %215 yıllık büyüme. 99,9% başarı oranıyla 190 ülkede aktif. Sequoia, a16z ve Tiger Global tarafından destekleniyor.',
    invCtaTitle: 'Yatırım yapmak ister misiniz?',
    invCtaDesc: 'Şu anda Seri B turunu yürütüyoruz. Yatırımcı ilişkileri ekibimizle iletişime geçin.',
    invCtaButton: 'Yatırımcı İlişkileri ile İletişime Geç',

    // FAQPage
    faqDesc: 'Chapar hakkında bilmeniz gereken her şey',
    faqQ1: 'Emanet koruması nasıl çalışır?',
    faqA1: 'Bir gönderi oluşturduğunuzda, ödeme şifreli emanet hesabımızda güvenle tutulur. Fonlar yalnızca başarılı teslimatı onayladıktan sonra yolcuya serbest bırakılır. Herhangi bir anlaşmazlık olursa, çözüm ekibimiz tam iade korumasıyla her iki taraf için adil sonuçlar araştırır ve sağlar.',
    faqQ2: 'Yolcular nasıl doğrulanır?',
    faqA2: 'Her yolcu, devlet kimliği, pasaport doğrulama, sabıka kaydı kontrolü ve yüz tanıma dahil kapsamlı kimlik doğrulamadan geçer. Minimum 4,5 yıldız derecelendirmesini korumaları gerekir ve sürekli izlemeyle yapay zeka destekli dolandırıcılık tespiti kullanıyoruz.',
    faqQ3: 'Chapar üzerinden ne gönderebi­lirim?',
    faqA3: 'Çoğu kişisel eşya, belge, elektronik, hediye ve 15 kg altındaki küçük işletme ürünlerini gönderebilirsiniz. Yasaklı ürünler arasında tehlikeli maddeler, yasadışı maddeler, silahlar, canlı hayvanlar, bozulabilir ürünler ve özel izin gerektiren eşyalar yer alır.',
    faqQ4: 'Paketim gelmezse ne olur?',
    faqA4: 'Her gönderi, ekstra ücret ödemeksizin 10.000 dolara kadar otomatik sigorta kapsamı içerir. Teslimat kararlaştırılan süre içinde onaylanmazsa, beyan edilen değer için tam iade ve sigorta tazminatı alırsınız. 7/24 destek ekibimiz sorunları 48 saat içinde çözer.',
    faqQ5: 'Yolcu olarak ne kadar kazanabilirim?',
    faqA5: 'Kazançlar rotaya, paket boyutuna, teslimat aciliyetine ve hedefe göre değişir. Çoğu yolcu teslimat başına 50–300 dolar kazanır, en çok kazananlar yıllık 15.000 doların üzerinde gelir elde eder. Kendi ücretlerinizi siz belirlersiniz ve hangi paketleri kabul edeceğinizi siz seçersiniz.',
    faqQ6: 'Chapar ülkemde mevcut mu?',
    faqA6: 'Evet! Chapar, dünya nüfusunun %95\'ini kapsayan aktif rotalarla tüm kıtalarda 190\'dan fazla ülkede faaliyet göstermektedir. Yapay zeka eşleştirme sistemimiz uzak konumlarda bile en uygun rotaları bulur.',
    faqQ7: 'Yapay zeka eşleştirme nasıl çalışır?',
    faqA7: 'Tescilli yapay zekamız, her gönderi talebi için en iyi eşleşmeyi anında bulmak üzere — rota popülaritesi, yolcu puanları, paket gereksinimleri, zamanlama ve fiyatlandırma — binlerce veri noktasını analiz eder.',
    faqQ8: 'Ödeme bilgilerim güvende mi?',
    faqA8: 'Kesinlikle. PCI DSS Seviye 1 uyumlu ödeme işleme, AES-256 şifreleme kullanıyoruz ve tam kart numaralarını asla saklamıyoruz. Tüm işlemler şifreli emanet sistemimizden geçer.',
    heroCta1: 'Satın Alma Kaydet',
    heroCta2: 'Seyahat Güzergahı',
    heroCta3: 'Paket Gönder',
  },

  ar: {
    headline: 'بنية تحتية للثقة العالمية للتجارة عبر الحدود',
    subheadline: 'اشترِ وأرسل وسلّم البضائع في جميع أنحاء العالم مع مسافرين موثوقين ومدفوعات ضمانية وذكاء اصطناعي.',
    buyForMe: 'اشتري لي',
    sendPackage: 'أرسل طرداً',
    becomeTraveler: 'كن مسافراً',
    escrowProtected: 'محمي بالضمان',
    aiVerified: 'موثق بالذكاء الاصطناعي',
    globalNetwork: 'شبكة عالمية',
    countries190: 'أكثر من ١٩٠ دولة',
    marketplace: 'السوق',
    security: 'الأمان',
    investors: 'المستثمرون',
    faq: 'الأسئلة الشائعة',
    signIn: 'تسجيل الدخول',
    getStarted: 'ابدأ الآن',
    howItWorks: 'كيف يعمل',
    globalRoutes: 'المسارات العالمية',
    liveActivity: 'النشاط المباشر',
    trustSafety: 'الثقة والأمان',
    app: 'التطبيق',
    buyForMeTitle: 'اشتري لي',
    buyForMeDesc: 'اطلب المنتجات من أي مكان في العالم',
    sendPackageTitle: 'أرسل طرداً',
    sendPackageDesc: 'أرسل طرودك مع مسافرين موثوقين',
    travelerTitle: 'كن مسافراً',
    travelerDesc: 'اكسب المال في رحلاتك',
    marketplaceTitle: 'سوق المسارات',
    trustSafetyTitle: 'الثقة والأمان',
    investorsTitle: 'فرصة الاستثمار',
    faqTitle: 'الأسئلة الشائعة',
    joinNetwork: 'انضم إلى الشبكة',
    backHome: 'العودة للرئيسية',
    step1Title: 'إنشاء شحنة',
    step1Desc: 'أدخل تفاصيل الطرد والوجهة والجدول الزمني. تسعير مدعوم بالذكاء الاصطناعي.',
    step2Title: 'مطابقة مسافر',
    step2Desc: 'يقوم ذكاؤنا الاصطناعي فوراً بمطابقتك مع مسافرين موثوقين متجهين إلى وجهتك.',
    step3Title: 'تسليم آمن',
    step3Desc: 'تتبع في الوقت الفعلي. يُفرج عن المدفوعات فقط بعد تأكيد التسليم.',

    // BuyForMePage
    bfmFormTitle: 'ماذا تريد أن تشتري؟',
    bfmProductLabel: 'اسم المنتج / الرابط',
    bfmProductPlaceholder: 'مثال: iPhone 15 Pro أو الصق الرابط',
    bfmBuyFromLabel: 'الشراء من (الدولة)',
    bfmBuyFromPlaceholder: 'مثال: الولايات المتحدة',
    bfmDeliverToLabel: 'التسليم إلى',
    bfmDeliverToPlaceholder: 'مثال: طهران، إيران',
    bfmBudgetLabel: 'الحد الأقصى للميزانية (دولار)',
    bfmNotesLabel: 'ملاحظات إضافية',
    bfmNotesPlaceholder: 'المقاس، اللون، الموديل المحدد...',
    bfmFindTraveler: 'البحث عن مسافر',
    bfmHowTitle: 'كيف يعمل الشراء بالنيابة',
    bfmHowStep1Title: 'أخبرنا ما تريد',
    bfmHowStep1Desc: 'شارك رابط المنتج أو صف ما تحتاجه من أي دولة.',
    bfmHowStep2Title: 'تطابق مع مسافر',
    bfmHowStep2Desc: 'نجد مسافراً موثوقاً يتجه من تلك الدولة إلى مدينتك.',
    bfmHowStep3Title: 'دفع ضماني آمن',
    bfmHowStep3Desc: 'تُحتجز أموالك بأمان حتى يتم تسليم المنتج إليك.',
    bfmHowStep4Title: 'استلم منتجك',
    bfmHowStep4Desc: 'أكد الاستلام وتُحرر الأموال. بسيط وآمن وسريع.',
    bfmCostTitle: 'تفصيل التكلفة التقديرية',
    bfmCostProduct: 'سعر المنتج',
    bfmCostTravelerFee: 'رسوم المسافر (8%)',
    bfmCostPlatform: 'رسوم المنصة',
    bfmCostInsurance: 'التأمين',
    bfmCostIncluded: 'مشمول',
    bfmCostTotal: 'التقدير الإجمالي',

    // SendPackagePage
    spFormTitle: 'تفاصيل الطرد',
    spFromLabel: 'من',
    spFromPlaceholder: 'مدينة الإرسال',
    spToLabel: 'إلى',
    spToPlaceholder: 'مدينة الوجهة',
    spWeightLabel: 'الوزن (كجم)',
    spValueLabel: 'القيمة (دولار)',
    spDeadlineLabel: 'الموعد النهائي',
    spDescLabel: 'وصف المحتويات',
    spDescPlaceholder: 'صف محتويات طردك...',
    spServiceTierLabel: 'مستوى الخدمة',
    spTierStandard: 'عادي',
    spTierExpress: 'سريع',
    spTierSameDay: 'نفس اليوم',
    spDays57: '٥–٧ أيام',
    spDays23: '٢–٣ أيام',
    sp24Hours: '٢٤ ساعة',
    spPostPackage: 'نشر الطرد',
    spWhyTitle: 'لماذا الإرسال مع Chapar؟',
    spBenefit1Val: '60% أرخص',
    spBenefit1Lbl: 'مقارنةً بشركات الشحن التقليدية',
    spBenefit2Val: 'متوسط 2–4 أيام',
    spBenefit2Lbl: 'وقت التسليم',
    spBenefit3Val: 'تأمين بـ10,000 دولار',
    spBenefit3Lbl: 'لكل طرد',
    spBenefit4Val: 'تتبع فوري',
    spBenefit4Lbl: 'تحديثات GPS',
    spSuccessRate: 'معدل النجاح',
    spDeliveries: 'أكثر من 12.5 مليون تسليم',

    // TravelerPage
    travHowTitle: 'كيف تصبح مسافراً في Chapar',
    travStep1Title: 'أنشئ ملفك الشخصي',
    travStep1Desc: 'سجّل واستكمل ملف المسافر بتاريخ رحلاتك.',
    travStep2Title: 'التحقق من الهوية',
    travStep2Desc: 'ارفع جواز سفرك/هويتك. التحقق بالذكاء الاصطناعي يستغرق أقل من 5 دقائق.',
    travStep3Title: 'أضف مسارك',
    travStep3Desc: 'أخبرنا بتاريخ رحلتك ومدينة المغادرة والوصول.',
    travStep4Title: 'اقبل الطرود',
    travStep4Desc: 'تصفح طلبات الطرود على مسارك واقبل ما يناسبك.',
    travStep5Title: 'سلّم واكسب',
    travStep5Desc: 'سلّم الطرد واستلم الدفع الفوري بعد التأكيد.',
    travCalcTitle: 'حاسبة الأرباح',
    travLuggageLabel: 'مساحة الأمتعة المتاحة (كجم):',
    travEstPerTrip: 'التقدير لكل رحلة',
    travAvgPricing: 'بناءً على متوسط تسعير المسارات',
    travMonthly: 'شهرياً (رحلتان)',
    travAnnually: 'سنوياً (24 رحلة)',
    travReqTitle: 'متطلبات المسافر',
    travReq1: 'جواز سفر ساري',
    travReq2: '18 عاماً فأكثر',
    travReq3: 'سجل جنائي نظيف',
    travReq4: 'هوية موثقة',
    travReq5: 'قبول شروط الخدمة',
    travRegister: 'التسجيل كمسافر',

    // MarketplacePage
    mktBrowseDesc: 'تصفح المسارات النشطة مع المسافرين المتاحين',
    mktAllRoutes: 'جميع المسارات',
    mktToTehran: 'إلى طهران',
    mktToDubai: 'إلى دبي',
    mktToLondon: 'إلى لندن',
    mktToNewYork: 'إلى نيويورك',
    mktToToronto: 'إلى تورنتو',
    mktLoadMore: 'تحميل مسارات أكثر',

    // TrustSafetyPage
    tsDesc: 'كيف نحافظ على أمان كل معاملة',
    tsSecurityLayers: 'طبقات الأمان',
    tsSoc2Desc: 'مراجعات سنوية من طرف ثالث',
    tsIsoDesc: 'إدارة أمن المعلومات',
    tsPciDesc: 'أعلى مستوى لأمان الدفع',
    tsGdprDesc: 'الامتثال الكامل لحماية البيانات',
    tsCertified: 'معتمد',
    tsCompliant: 'ملتزم',
    tsVerifiedBadge: 'موثق',
    tsEscrowTitle: 'نظام الدفع الضماني',
    tsEscrowDesc: 'كل معاملة محمية بنظامنا الضماني على مستوى البنوك. لا تغادر الأموال خزننا الآمن حتى يؤكد الطرفان التسليم الناجح.',
    tsAiTitle: 'التحقق بالذكاء الاصطناعي',
    tsAi1Title: 'التحقق من الهوية',
    tsAi1Desc: 'هوية حكومية + التعرف على الوجه مع اكتشاف الحيوية.',
    tsAi2Title: 'فحص الخلفية',
    tsAi2Desc: 'فحوصات آلية عبر قواعد البيانات الدولية.',
    tsAi3Title: 'التحليل السلوكي',
    tsAi3Desc: 'مراقبة الذكاء الاصطناعي المستمرة ترصد الأنماط المشبوهة.',
    tsAi4Title: 'مسح الطرود',
    tsAi4Desc: 'تحليل صور بالذكاء الاصطناعي للعناصر المحظورة.',
    tsAi5Title: 'كشف الاحتيال على مدار الساعة',
    tsAi5Desc: 'مراقبة المعاملات في الوقت الفعلي مع تنبيهات فورية.',

    // InvestorsPage
    invDesc: 'انضم إلى ثورة التجارة عبر الحدود',
    invNetworkUsers: 'مستخدمو الشبكة',
    invCountries: 'الدول',
    invTAM: 'إجمالي السوق المستهدف',
    invRevenueGrowth: 'نمو الإيرادات',
    invGlobalCoverage: 'التغطية العالمية',
    invExpandingMarket: 'سوق متنامٍ',
    invYearOverYear: 'سنة بعد سنة',
    invYoY127: '+127% سنوياً',
    invProblemTitle: 'المشكلة',
    invProblemDesc: 'الشحن التقليدي بطيء ومكلف وغير متاح لـ40% من المسارات العالمية. تجارة التجزئة الإلكترونية عبر الحدود تنمو بنسبة 25% سنوياً لكن اللوجستيات لم تتطور.',
    invSolutionTitle: 'الحل',
    invSolutionDesc: 'يستخدم Chapar 1.4 مليار مسافر سنوي لإنشاء شبكة تسليم عالمية من نظير إلى نظير. أسرع 3–5 أضعاف، أرخص بنسبة 60%، مع حماية ضمانية كاملة وتأمين.',
    invTractionTitle: 'الزخم',
    invTractionDesc: '50 مليون مستخدم، أكثر من 100 مليون دولار GMV، نمو 215% سنوياً. نشط في 190 دولة بمعدل نجاح 99.9%. بدعم من Sequoia وa16z وTiger Global.',
    invCtaTitle: 'هل أنت مهتم بالاستثمار؟',
    invCtaDesc: 'نحن نجمع حالياً جولة Series B. تواصل مع فريق علاقات المستثمرين لدينا.',
    invCtaButton: 'التواصل مع علاقات المستثمرين',

    // FAQPage
    faqDesc: 'كل ما تحتاج معرفته عن Chapar',
    faqQ1: 'كيف تعمل الحماية الضمانية؟',
    faqA1: 'عند إنشاء شحنة، يُحتجز الدفع بأمان في حساب الضمان المشفر لدينا. تُحرر الأموال فقط للمسافر بعد تأكيد التسليم الناجح. في حالة أي نزاع، يحقق فريق الحل لدينا ويضمن نتائج عادلة لكلا الطرفين مع حماية كاملة للاسترداد.',
    faqQ2: 'كيف يتم التحقق من المسافرين؟',
    faqA2: 'يخضع كل مسافر لتحقق شامل من الهوية يشمل الهوية الحكومية وتحقق جواز السفر وفحوصات الخلفية والتعرف على الوجه. يجب عليهم الحفاظ على حد أدنى 4.5 نجوم ونستخدم كشف الاحتيال بالذكاء الاصطناعي مع المراقبة المستمرة.',
    faqQ3: 'ما العناصر التي يمكنني إرسالها عبر Chapar؟',
    faqA3: 'يمكنك إرسال معظم الأغراض الشخصية والوثائق والإلكترونيات والهدايا والمنتجات التجارية الصغيرة التي تقل عن 15 كجم. العناصر المحظورة تشمل المواد الخطرة والمواد غير القانونية والأسلحة والحيوانات الحية والمواد القابلة للتلف والعناصر التي تتطلب تصاريح خاصة.',
    faqQ4: 'ماذا يحدث إذا لم تصل طردي؟',
    faqA4: 'تشمل كل شحنة تغطية تأمينية تلقائية تصل إلى 10,000 دولار دون تكلفة إضافية. إذا لم يُؤكد التسليم خلال الإطار الزمني المتفق عليه، تحصل على استرداد كامل بالإضافة إلى مطالبة تأمينية للقيمة المُعلنة. فريق الدعم على مدار الساعة يحل المشكلات خلال 48 ساعة.',
    faqQ5: 'كم يمكنني أن أكسب كمسافر؟',
    faqA5: 'تختلف الأرباح حسب المسار وحجم الطرد وإلحاحية التسليم والوجهة. يكسب معظم المسافرين 50–300 دولار لكل تسليم، والأكثر ربحاً يحققون أكثر من 15,000 دولار سنوياً. أنت تحدد أسعارك الخاصة وتختار الطرود التي تقبلها.',
    faqQ6: 'هل Chapar متاح في بلدي؟',
    faqA6: 'نعم! يعمل Chapar في أكثر من 190 دولة عبر جميع القارات بمسارات نشطة تغطي 95% من سكان العالم. يجد نظام المطابقة بالذكاء الاصطناعي لدينا المسارات المثلى حتى في المواقع النائية.',
    faqQ7: 'كيف تعمل المطابقة بالذكاء الاصطناعي؟',
    faqA7: 'يحلل ذكاؤنا الاصطناعي الخاص آلاف نقاط البيانات — شعبية المسار وتقييمات المسافرين ومتطلبات الطرد والتوقيت والتسعير — للعثور فوراً على أفضل تطابق لكل طلب شحن.',
    faqQ8: 'هل معلومات الدفع الخاصة بي آمنة؟',
    faqA8: 'بالتأكيد. نستخدم معالجة دفع متوافقة مع PCI DSS المستوى الأول وتشفير AES-256 ولا نخزن أرقام البطاقات الكاملة أبداً. تمر جميع المعاملات عبر نظام الضمان المشفر لدينا.',
    heroCta1: 'تسجيل شراء',
    heroCta2: 'تسجيل مسار',
    heroCta3: 'إرسال طرد',
  },

  fr: {
    headline: 'Infrastructure de confiance mondiale pour le commerce sans frontières',
    subheadline: 'Achetez, envoyez et livrez des marchandises dans le monde entier avec des voyageurs vérifiés, des paiements sous séquestre et l\'IA.',
    buyForMe: 'Acheter pour moi',
    sendPackage: 'Envoyer un colis',
    becomeTraveler: 'Devenir voyageur',
    escrowProtected: 'Protégé par séquestre',
    aiVerified: 'Vérifié par IA',
    globalNetwork: 'Réseau mondial',
    countries190: 'Plus de 190 pays',
    marketplace: 'Marché',
    security: 'Sécurité',
    investors: 'Investisseurs',
    faq: 'FAQ',
    signIn: 'Se connecter',
    getStarted: 'Commencer',
    howItWorks: 'Comment ça marche',
    globalRoutes: 'Routes mondiales',
    liveActivity: 'Activité en direct',
    trustSafety: 'Confiance et sécurité',
    app: 'Application',
    buyForMeTitle: 'Acheter pour moi',
    buyForMeDesc: 'Commandez des produits de n\'importe où dans le monde',
    sendPackageTitle: 'Envoyer un colis',
    sendPackageDesc: 'Expédiez vos colis avec des voyageurs vérifiés',
    travelerTitle: 'Devenir voyageur',
    travelerDesc: 'Gagnez de l\'argent lors de vos voyages',
    marketplaceTitle: 'Marché des itinéraires',
    trustSafetyTitle: 'Confiance et sécurité',
    investorsTitle: 'Opportunité d\'investissement',
    faqTitle: 'Questions fréquentes',
    joinNetwork: 'Rejoindre le réseau',
    backHome: 'Retour à l\'accueil',
    step1Title: 'Créer une expédition',
    step1Desc: 'Saisissez les détails de votre colis, la destination et le calendrier.',
    step2Title: 'Correspondre avec un voyageur',
    step2Desc: 'Notre IA vous met instantanément en relation avec des voyageurs vérifiés.',
    step3Title: 'Livraison sécurisée',
    step3Desc: 'Suivi en temps réel. Le paiement n\'est libéré qu\'après confirmation de livraison.',

    // BuyForMePage
    bfmFormTitle: 'Que souhaitez-vous acheter ?',
    bfmProductLabel: 'Nom du produit / URL',
    bfmProductPlaceholder: 'ex. iPhone 15 Pro ou collez l\'URL',
    bfmBuyFromLabel: 'Acheter depuis (Pays)',
    bfmBuyFromPlaceholder: 'ex. États-Unis',
    bfmDeliverToLabel: 'Livrer à',
    bfmDeliverToPlaceholder: 'ex. Téhéran, Iran',
    bfmBudgetLabel: 'Budget maximum (USD)',
    bfmNotesLabel: 'Notes supplémentaires',
    bfmNotesPlaceholder: 'Taille, couleur, modèle spécifique...',
    bfmFindTraveler: 'Trouver un voyageur',
    bfmHowTitle: 'Comment fonctionne Acheter pour moi',
    bfmHowStep1Title: 'Dites-nous ce que vous voulez',
    bfmHowStep1Desc: 'Partagez l\'URL du produit ou décrivez ce dont vous avez besoin depuis n\'importe quel pays.',
    bfmHowStep2Title: 'Correspondre avec un voyageur',
    bfmHowStep2Desc: 'Nous trouvons un voyageur vérifié se rendant de ce pays à votre ville.',
    bfmHowStep3Title: 'Paiement sécurisé sous séquestre',
    bfmHowStep3Desc: 'Vos fonds sont conservés en sécurité jusqu\'à ce que l\'article vous soit livré.',
    bfmHowStep4Title: 'Recevez votre article',
    bfmHowStep4Desc: 'Confirmez la livraison et les fonds sont libérés. Simple, sûr, rapide.',
    bfmCostTitle: 'Estimation des coûts',
    bfmCostProduct: 'Prix du produit',
    bfmCostTravelerFee: 'Frais de voyageur (8 %)',
    bfmCostPlatform: 'Frais de plateforme',
    bfmCostInsurance: 'Assurance',
    bfmCostIncluded: 'Inclus',
    bfmCostTotal: 'Estimation totale',

    // SendPackagePage
    spFormTitle: 'Détails du colis',
    spFromLabel: 'De',
    spFromPlaceholder: 'Ville d\'origine',
    spToLabel: 'À',
    spToPlaceholder: 'Ville de destination',
    spWeightLabel: 'Poids (kg)',
    spValueLabel: 'Valeur (USD)',
    spDeadlineLabel: 'Date limite',
    spDescLabel: 'Description de l\'article',
    spDescPlaceholder: 'Décrivez le contenu de votre colis...',
    spServiceTierLabel: 'Niveau de service',
    spTierStandard: 'Standard',
    spTierExpress: 'Express',
    spTierSameDay: 'Même jour',
    spDays57: '5–7 jours',
    spDays23: '2–3 jours',
    sp24Hours: '24 heures',
    spPostPackage: 'Publier le colis',
    spWhyTitle: 'Pourquoi envoyer avec Chapar ?',
    spBenefit1Val: '60 % moins cher',
    spBenefit1Lbl: 'vs les transporteurs traditionnels',
    spBenefit2Val: 'moy. 2–4 jours',
    spBenefit2Lbl: 'délai de livraison',
    spBenefit3Val: 'Assurance 10 000 $',
    spBenefit3Lbl: 'par colis',
    spBenefit4Val: 'Suivi en temps réel',
    spBenefit4Lbl: 'mises à jour GPS',
    spSuccessRate: 'Taux de succès',
    spDeliveries: 'Plus de 12,5 millions de livraisons',

    // TravelerPage
    travHowTitle: 'Comment devenir un voyageur Chapar',
    travStep1Title: 'Créez votre profil',
    travStep1Desc: 'Inscrivez-vous et complétez votre profil de voyageur avec votre historique de voyage.',
    travStep2Title: 'Vérification d\'identité',
    travStep2Desc: 'Téléchargez votre passeport/ID. La vérification par IA prend moins de 5 minutes.',
    travStep3Title: 'Ajoutez votre itinéraire',
    travStep3Desc: 'Indiquez la date de votre vol, la ville de départ et d\'arrivée.',
    travStep4Title: 'Acceptez des colis',
    travStep4Desc: 'Parcourez les demandes de colis sur votre itinéraire et acceptez ceux qui vous conviennent.',
    travStep5Title: 'Livrez et gagnez',
    travStep5Desc: 'Remettez le colis et recevez un paiement instantané après confirmation.',
    travCalcTitle: 'Calculateur de revenus',
    travLuggageLabel: 'Espace bagages disponible (kg) :',
    travEstPerTrip: 'Estimation par voyage',
    travAvgPricing: 'Basé sur la tarification moyenne des itinéraires',
    travMonthly: 'Mensuel (2 voyages)',
    travAnnually: 'Annuel (24 voyages)',
    travReqTitle: 'Conditions requises pour les voyageurs',
    travReq1: 'Passeport valide',
    travReq2: '18 ans et plus',
    travReq3: 'Casier judiciaire vierge',
    travReq4: 'Identité vérifiée',
    travReq5: 'Accepter les conditions d\'utilisation',
    travRegister: 'S\'inscrire comme voyageur',

    // MarketplacePage
    mktBrowseDesc: 'Parcourez les itinéraires actifs avec des voyageurs disponibles',
    mktAllRoutes: 'Tous les itinéraires',
    mktToTehran: 'Vers Téhéran',
    mktToDubai: 'Vers Dubaï',
    mktToLondon: 'Vers Londres',
    mktToNewYork: 'Vers New York',
    mktToToronto: 'Vers Toronto',
    mktLoadMore: 'Charger plus d\'itinéraires',

    // TrustSafetyPage
    tsDesc: 'Comment nous sécurisons chaque transaction',
    tsSecurityLayers: 'Couches de sécurité',
    tsSoc2Desc: 'Audits annuels par des tiers',
    tsIsoDesc: 'Gestion de la sécurité de l\'information',
    tsPciDesc: 'Plus haut niveau de sécurité des paiements',
    tsGdprDesc: 'Conformité totale à la protection des données',
    tsCertified: 'Certifié',
    tsCompliant: 'Conforme',
    tsVerifiedBadge: 'Vérifié',
    tsEscrowTitle: 'Système de paiement sous séquestre',
    tsEscrowDesc: 'Chaque transaction est protégée par notre séquestre bancaire. Les fonds ne quittent jamais notre coffre sécurisé jusqu\'à ce que les deux parties confirment la livraison réussie.',
    tsAiTitle: 'Vérification par IA',
    tsAi1Title: 'Vérification d\'identité',
    tsAi1Desc: 'Pièce d\'identité officielle + reconnaissance faciale avec détection de vivacité.',
    tsAi2Title: 'Vérification des antécédents',
    tsAi2Desc: 'Vérifications automatisées dans les bases de données internationales.',
    tsAi3Title: 'Analyse comportementale',
    tsAi3Desc: 'La surveillance continue de l\'IA signale les comportements suspects.',
    tsAi4Title: 'Analyse des colis',
    tsAi4Desc: 'Analyse d\'image par IA pour les articles prohibés.',
    tsAi5Title: 'Détection de fraude 24h/24 7j/7',
    tsAi5Desc: 'Surveillance des transactions en temps réel avec alertes instantanées.',

    // InvestorsPage
    invDesc: 'Rejoignez la révolution du commerce transfrontalier',
    invNetworkUsers: 'Utilisateurs du réseau',
    invCountries: 'Pays',
    invTAM: 'Marché adressable total',
    invRevenueGrowth: 'Croissance des revenus',
    invGlobalCoverage: 'Couverture mondiale',
    invExpandingMarket: 'Marché en expansion',
    invYearOverYear: 'D\'une année sur l\'autre',
    invYoY127: '+127 % par an',
    invProblemTitle: 'Problème',
    invProblemDesc: 'La livraison traditionnelle est lente, coûteuse et inaccessible pour 40 % des routes mondiales. Le commerce électronique transfrontalier croît de 25 % par an mais la logistique n\'a pas évolué.',
    invSolutionTitle: 'Solution',
    invSolutionDesc: 'Chapar exploite 1,4 milliard de voyageurs annuels pour créer un réseau de livraison mondial de pair à pair. 3–5 fois plus rapide, 60 % moins cher, avec une protection séquestre complète et une assurance.',
    invTractionTitle: 'Traction',
    invTractionDesc: '50 millions d\'utilisateurs, plus de 100 millions $ de GMV, croissance de 215 % par an. Actif dans 190 pays avec un taux de réussite de 99,9 %. Soutenu par Sequoia, a16z et Tiger Global.',
    invCtaTitle: 'Intéressé par un investissement ?',
    invCtaDesc: 'Nous levons actuellement notre Série B. Prenez contact avec notre équipe de relations investisseurs.',
    invCtaButton: 'Contacter les relations investisseurs',

    // FAQPage
    faqDesc: 'Tout ce que vous devez savoir sur Chapar',
    faqQ1: 'Comment fonctionne la protection par séquestre ?',
    faqA1: 'Lorsque vous créez une expédition, le paiement est conservé en sécurité dans notre compte séquestre crypté. Les fonds ne sont libérés au voyageur qu\'après confirmation de la livraison réussie. En cas de litige, notre équipe de résolution enquête et garantit des résultats équitables pour les deux parties avec une protection complète de remboursement.',
    faqQ2: 'Comment les voyageurs sont-ils vérifiés ?',
    faqA2: 'Chaque voyageur subit une vérification d\'identité complète incluant la pièce d\'identité officielle, la vérification du passeport, les vérifications des antécédents et la reconnaissance faciale. Ils doivent maintenir une note minimale de 4,5 étoiles et nous utilisons la détection de fraude par IA avec surveillance continue.',
    faqQ3: 'Quels articles puis-je envoyer via Chapar ?',
    faqA3: 'Vous pouvez envoyer la plupart des articles personnels, documents, appareils électroniques, cadeaux et petits produits commerciaux de moins de 15 kg. Les articles interdits comprennent les matières dangereuses, les substances illicites, les armes, les animaux vivants, les denrées périssables et les articles nécessitant des permis spéciaux.',
    faqQ4: 'Que se passe-t-il si mon colis n\'arrive pas ?',
    faqA4: 'Chaque expédition inclut une couverture d\'assurance automatique allant jusqu\'à 10 000 $ sans frais supplémentaires. Si la livraison n\'est pas confirmée dans le délai convenu, vous recevez un remboursement complet ainsi qu\'une indemnité d\'assurance pour la valeur déclarée. Notre équipe d\'assistance 24h/24 résout les problèmes en 48 heures.',
    faqQ5: 'Combien puis-je gagner en tant que voyageur ?',
    faqA5: 'Les gains varient selon l\'itinéraire, la taille du colis, l\'urgence de la livraison et la destination. La plupart des voyageurs gagnent 50–300 $ par livraison, les meilleurs gagnants réalisant plus de 15 000 $ par an. Vous fixez vos propres tarifs et choisissez les colis à accepter.',
    faqQ6: 'Chapar est-il disponible dans mon pays ?',
    faqA6: 'Oui ! Chapar opère dans plus de 190 pays sur tous les continents avec des itinéraires actifs couvrant 95 % de la population mondiale. Notre système de correspondance par IA trouve des itinéraires optimaux même dans les endroits reculés.',
    faqQ7: 'Comment fonctionne la correspondance par IA ?',
    faqA7: 'Notre IA propriétaire analyse des milliers de points de données — popularité des itinéraires, notes des voyageurs, exigences des colis, timing et tarification — pour trouver instantanément la meilleure correspondance pour chaque demande d\'expédition.',
    faqQ8: 'Mes informations de paiement sont-elles sécurisées ?',
    faqA8: 'Absolument. Nous utilisons un traitement des paiements conforme PCI DSS Niveau 1, le chiffrement AES-256 et ne stockons jamais les numéros de carte complets. Toutes les transactions passent par notre système séquestre crypté.',
    heroCta1: 'Commander',
    heroCta2: 'Voyageur',
    heroCta3: 'Envoyer',
  },

  zh: {
    headline: '无国界贸易的全球信任基础设施',
    subheadline: '通过经过验证的旅行者、代管付款和人工智能在全球范围内购买、发送和交付商品。',
    buyForMe: '帮我购买',
    sendPackage: '发送包裹',
    becomeTraveler: '成为旅行者',
    escrowProtected: '代管保护',
    aiVerified: 'AI 认证',
    globalNetwork: '全球网络',
    countries190: '190+ 个国家',
    marketplace: '市场',
    security: '安全',
    investors: '投资者',
    faq: '常见问题',
    signIn: '登录',
    getStarted: '开始使用',
    howItWorks: '运作方式',
    globalRoutes: '全球路线',
    liveActivity: '实时活动',
    trustSafety: '信任与安全',
    app: '应用程序',
    buyForMeTitle: '帮我购买',
    buyForMeDesc: '从世界任何地方订购产品',
    sendPackageTitle: '发送包裹',
    sendPackageDesc: '通过经过验证的旅行者运送您的包裹',
    travelerTitle: '成为旅行者',
    travelerDesc: '在旅途中赚取收入',
    marketplaceTitle: '路线市场',
    trustSafetyTitle: '信任与安全',
    investorsTitle: '投资机会',
    faqTitle: '常见问题',
    joinNetwork: '加入网络',
    backHome: '返回首页',
    step1Title: '创建货运',
    step1Desc: '输入包裹详情、目的地和时间表。AI 定价。',
    step2Title: '匹配旅行者',
    step2Desc: '我们的 AI 即时将您与前往目的地的经认证旅行者匹配。',
    step3Title: '安全交付',
    step3Desc: '实时追踪。仅在确认交付后释放付款。',

    // BuyForMePage
    bfmFormTitle: '您想购买什么？',
    bfmProductLabel: '产品名称 / 链接',
    bfmProductPlaceholder: '例如 iPhone 15 Pro 或粘贴链接',
    bfmBuyFromLabel: '从哪里购买（国家）',
    bfmBuyFromPlaceholder: '例如 美国',
    bfmDeliverToLabel: '送达地址',
    bfmDeliverToPlaceholder: '例如 德黑兰，伊朗',
    bfmBudgetLabel: '最高预算（美元）',
    bfmNotesLabel: '附加说明',
    bfmNotesPlaceholder: '尺寸、颜色、具体型号...',
    bfmFindTraveler: '寻找旅行者',
    bfmHowTitle: '帮我购买的运作方式',
    bfmHowStep1Title: '告诉我们您想要什么',
    bfmHowStep1Desc: '分享产品链接或描述您需要从哪个国家获取的商品。',
    bfmHowStep2Title: '匹配旅行者',
    bfmHowStep2Desc: '我们找到一位从该国前往您城市的经认证旅行者。',
    bfmHowStep3Title: '安全代管付款',
    bfmHowStep3Desc: '您的资金安全保管，直到物品交付给您为止。',
    bfmHowStep4Title: '收取您的物品',
    bfmHowStep4Desc: '确认收货，资金即释放。简单、安全、快速。',
    bfmCostTitle: '预估费用明细',
    bfmCostProduct: '产品价格',
    bfmCostTravelerFee: '旅行者费用（8%）',
    bfmCostPlatform: '平台费用',
    bfmCostInsurance: '保险',
    bfmCostIncluded: '已包含',
    bfmCostTotal: '总计估算',

    // SendPackagePage
    spFormTitle: '包裹详情',
    spFromLabel: '从',
    spFromPlaceholder: '出发城市',
    spToLabel: '到',
    spToPlaceholder: '目的地城市',
    spWeightLabel: '重量（千克）',
    spValueLabel: '价值（美元）',
    spDeadlineLabel: '截止日期',
    spDescLabel: '物品描述',
    spDescPlaceholder: '描述您的包裹内容...',
    spServiceTierLabel: '服务级别',
    spTierStandard: '标准',
    spTierExpress: '快递',
    spTierSameDay: '当天',
    spDays57: '5–7 天',
    spDays23: '2–3 天',
    sp24Hours: '24 小时',
    spPostPackage: '发布包裹',
    spWhyTitle: '为什么选择 Chapar 发送？',
    spBenefit1Val: '便宜 60%',
    spBenefit1Lbl: '与传统承运商相比',
    spBenefit2Val: '平均 2–4 天',
    spBenefit2Lbl: '交付时间',
    spBenefit3Val: '1 万美元保险',
    spBenefit3Lbl: '每件包裹',
    spBenefit4Val: '实时追踪',
    spBenefit4Lbl: 'GPS 更新',
    spSuccessRate: '成功率',
    spDeliveries: '超过 1250 万次配送',

    // TravelerPage
    travHowTitle: '如何成为 Chapar 旅行者',
    travStep1Title: '创建您的个人资料',
    travStep1Desc: '注册并填写带有旅行历史的旅行者资料。',
    travStep2Title: '身份验证',
    travStep2Desc: '上传您的护照/身份证。AI 验证不到 5 分钟即可完成。',
    travStep3Title: '添加您的路线',
    travStep3Desc: '告诉我们您的航班日期、出发地和目的地城市。',
    travStep4Title: '接受包裹',
    travStep4Desc: '浏览您路线上的包裹请求，接受您喜欢的那些。',
    travStep5Title: '交付并赚取收入',
    travStep5Desc: '交付包裹，确认后即时收款。',
    travCalcTitle: '收益计算器',
    travLuggageLabel: '可用行李空间（千克）：',
    travEstPerTrip: '每次旅行估计收益',
    travAvgPricing: '基于平均路线定价',
    travMonthly: '每月（2 次旅行）',
    travAnnually: '每年（24 次旅行）',
    travReqTitle: '旅行者要求',
    travReq1: '有效护照',
    travReq2: '18 岁以上',
    travReq3: '无犯罪记录',
    travReq4: '经过身份验证',
    travReq5: '接受服务条款',
    travRegister: '注册成为旅行者',

    // MarketplacePage
    mktBrowseDesc: '浏览有旅行者的活跃路线',
    mktAllRoutes: '所有路线',
    mktToTehran: '前往德黑兰',
    mktToDubai: '前往迪拜',
    mktToLondon: '前往伦敦',
    mktToNewYork: '前往纽约',
    mktToToronto: '前往多伦多',
    mktLoadMore: '加载更多路线',

    // TrustSafetyPage
    tsDesc: '我们如何确保每笔交易的安全',
    tsSecurityLayers: '安全层级',
    tsSoc2Desc: '第三方年度审计',
    tsIsoDesc: '信息安全管理',
    tsPciDesc: '最高级别的支付安全',
    tsGdprDesc: '完全数据保护合规',
    tsCertified: '已认证',
    tsCompliant: '合规',
    tsVerifiedBadge: '已验证',
    tsEscrowTitle: '代管付款系统',
    tsEscrowDesc: '每笔交易均受我们银行级代管系统保护。资金在双方确认成功交付之前，永远不会离开我们的安全保险库。',
    tsAiTitle: 'AI 验证',
    tsAi1Title: '身份验证',
    tsAi1Desc: '政府身份证 + 具备活体检测的人脸识别。',
    tsAi2Title: '背景调查',
    tsAi2Desc: '跨国际数据库的自动化检查。',
    tsAi3Title: '行为分析',
    tsAi3Desc: '持续 AI 监控标记可疑模式。',
    tsAi4Title: '包裹扫描',
    tsAi4Desc: 'AI 驱动的图像分析用于识别违禁物品。',
    tsAi5Title: '全天候欺诈检测',
    tsAi5Desc: '实时交易监控并发出即时警报。',

    // InvestorsPage
    invDesc: '加入跨境贸易革命',
    invNetworkUsers: '网络用户',
    invCountries: '国家',
    invTAM: '总目标市场',
    invRevenueGrowth: '营收增长',
    invGlobalCoverage: '全球覆盖',
    invExpandingMarket: '扩张中的市场',
    invYearOverYear: '同比增长',
    invYoY127: '+127% 同比',
    invProblemTitle: '问题',
    invProblemDesc: '传统运输对 40% 的全球路线而言速度慢、成本高且难以获取。跨境电商每年增长 25%，但物流尚未进化。',
    invSolutionTitle: '解决方案',
    invSolutionDesc: 'Chapar 利用每年 14 亿旅行者构建全球点对点配送网络。速度快 3–5 倍，成本低 60%，提供完整代管保护和保险。',
    invTractionTitle: '业务进展',
    invTractionDesc: '5000 万用户，超 1 亿美元 GMV，215% 同比增长。在 190 个国家活跃，成功率 99.9%。获 Sequoia、a16z 和 Tiger Global 支持。',
    invCtaTitle: '有意投资？',
    invCtaDesc: '我们目前正在进行 B 轮融资。请与我们的投资者关系团队联系。',
    invCtaButton: '联系投资者关系团队',

    // FAQPage
    faqDesc: '关于 Chapar 您需要了解的一切',
    faqQ1: '代管保护是如何运作的？',
    faqA1: '当您创建货运时，付款将安全地保存在我们的加密代管账户中。资金仅在您确认成功交付后才会释放给旅行者。如有任何纠纷，我们的解决团队将进行调查，并确保双方获得公平结果，提供完整退款保护。',
    faqQ2: '旅行者如何经过验证？',
    faqA2: '每位旅行者都要经过全面的身份验证，包括政府身份证、护照验证、背景调查和人脸识别。他们必须保持至少 4.5 星的评级，我们使用持续监控的 AI 欺诈检测。',
    faqQ3: '我可以通过 Chapar 发送哪些物品？',
    faqA3: '您可以发送大多数个人物品、文件、电子产品、礼品以及 15 千克以下的小型商业产品。禁止物品包括危险材料、违禁品、武器、活体动物、易腐物品以及需要特殊许可的物品。',
    faqQ4: '如果我的包裹没有到达会怎样？',
    faqA4: '每批货运均包含免费自动保险，保额高达 10,000 美元。如果在约定时间内未确认交付，您将获得全额退款以及申报价值的保险理赔。我们的 24/7 支持团队在 48 小时内解决问题。',
    faqQ5: '作为旅行者我能赚多少？',
    faqA5: '收益因路线、包裹大小、交付紧迫性和目的地而异。大多数旅行者每次交付赚取 50–300 美元，顶尖旅行者每年收入超过 15,000 美元。您自己设定费率并选择接受哪些包裹。',
    faqQ6: 'Chapar 在我的国家可用吗？',
    faqA6: '是的！Chapar 在全球 190 多个国家运营，活跃路线覆盖 95% 的全球人口。我们的 AI 匹配系统即使在偏远地区也能找到最优路线。',
    faqQ7: 'AI 匹配是如何运作的？',
    faqA7: '我们的专有 AI 分析数千个数据点——路线热度、旅行者评分、包裹要求、时间安排和定价——以即时找到每个货运请求的最佳匹配。',
    faqQ8: '我的付款信息安全吗？',
    faqA8: '当然。我们使用符合 PCI DSS 1 级标准的支付处理、AES-256 加密，从不存储完整卡号。所有交易均通过我们的加密代管系统进行。',
    heroCta1: '发起购买',
    heroCta2: '注册行程',
    heroCta3: '发送包裹',
  },
};
