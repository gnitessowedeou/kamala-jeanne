/**
 * ==============================================================================
 * VENDIA AI — NATIVE MULTI-LANGUAGE ENGINE (i18n)
 * Ultra-fast, zero-dependency, instantaneous translation for:
 * - Français (FR)
 * - English (EN)
 * - Español (ES)
 * - Português (PT)
 * - العربية (AR)
 * ==============================================================================
 */

(function(window) {
  'use strict';

  const VENDIA_LANGUAGES = {
    fr: { code: 'FR', name: 'Français', flag: 'https://flagcdn.com/w40/fr.png', dir: 'ltr' },
    en: { code: 'EN', name: 'English', flag: 'https://flagcdn.com/w40/gb.png', dir: 'ltr' },
    es: { code: 'ES', name: 'Español', flag: 'https://flagcdn.com/w40/es.png', dir: 'ltr' },
    pt: { code: 'PT', name: 'Português', flag: 'https://flagcdn.com/w40/br.png', dir: 'ltr' },
    ar: { code: 'AR', name: 'العربية', flag: 'https://flagcdn.com/w40/ae.png', dir: 'rtl' }
  };

  const DICTIONARY = {
    // Navigation & Header
    "Fonctionnalités": {
      en: "Features",
      es: "Funciones",
      pt: "Recursos",
      ar: "الميزات"
    },
    "Academy": {
      en: "Academy",
      es: "Academia",
      pt: "Academia",
      ar: "الأكاديمية"
    },
    "Academy Vidéos": {
      en: "Video Academy",
      es: "Academia en Video",
      pt: "Academia de Vídeos",
      ar: "أكاديمية الفيديو"
    },
    "Master Prompts": {
      en: "Master Prompts",
      es: "Master Prompts",
      pt: "Master Prompts",
      ar: "أوامر ماستر"
    },
    "Tarifs": {
      en: "Pricing",
      es: "Precios",
      pt: "Planos",
      ar: "الأسعار"
    },
    "Tarifs & Offres": {
      en: "Pricing & Offers",
      es: "Precios y Ofertas",
      pt: "Planos e Ofertas",
      ar: "الأسعار والعروض"
    },
    "Intégrations": {
      en: "Integrations",
      es: "Integraciones",
      pt: "Integrações",
      ar: "التكاملات"
    },
    "FAQ": {
      en: "FAQ",
      es: "Preguntas Frecuentes",
      pt: "FAQ",
      ar: "الأسئلة الشائعة"
    },
    "Connexion": {
      en: "Sign In",
      es: "Iniciar Sesión",
      pt: "Entrar",
      ar: "تسجيل الدخول"
    },
    "Accès Instantané": {
      en: "Instant Access",
      es: "Acceso Instantáneo",
      pt: "Acesso Instantâneo",
      ar: "وصول فوري"
    },
    "Choisir la langue": {
      en: "Choose language",
      es: "Elegir idioma",
      pt: "Escolher idioma",
      ar: "اختر اللغة"
    },
    "Langue du site": {
      en: "Site language",
      es: "Idioma del sitio",
      pt: "Idioma do site",
      ar: "لغة الموقع"
    },

    // Hero Section
    "Solution WhatsApp IA #1 — Tunnel de Vente 100% Automatisé": {
      en: "Top #1 WhatsApp AI Solution — 100% Automated Sales Funnel",
      es: "Solución WhatsApp IA #1 — Embudo de Ventas 100% Automatizado",
      pt: "Solução WhatsApp IA nº 1 — Funil de Vendas 100% Automatizado",
      ar: "الحل الأول لمبيعات واتساب بالذكاء الاصطناعي — مسار مبيعات مؤتمت 100%"
    },
    "Transformez WhatsApp en votre Meilleur Commercial IA 24h/24": {
      en: "Turn WhatsApp into your Best 24/7 AI Sales Rep",
      es: "Convierte WhatsApp en tu Mejor Vendedor IA 24/7",
      pt: "Transforme o WhatsApp no seu Melhor Vendedor IA 24/7",
      ar: "حوّل واتساب إلى أفضل مندوب مبيعات ذكاء اصطناعي 24/7"
    },
    "Transformez WhatsApp en": {
      en: "Turn WhatsApp into",
      es: "Convierte WhatsApp en",
      pt: "Transforme o WhatsApp no",
      ar: "حوّل واتساب إلى"
    },
    "votre Meilleur Commercial IA 24h/24": {
      en: "your Best 24/7 AI Sales Rep",
      es: "tu Mejor Vendedor IA 24/7",
      pt: "seu Melhor Vendedor IA 24/7",
      ar: "أفضل مندوب مبيعات ذكاء اصطناعي 24/7"
    },
    "votre": {
      en: "your",
      es: "tu",
      pt: "seu",
      ar: "لك"
    },
    "Meilleur Commercial": {
      en: "Best Sales Rep",
      es: "Mejor Vendedor",
      pt: "Melhor Vendedor",
      ar: "أفضل مندوب مبيعات"
    },
    "IA 24h/24": {
      en: "24/7 AI",
      es: "IA 24/7",
      pt: "IA 24/7",
      ar: "بالذكاء الاصطناعي 24/7"
    },
    "Diffusez des messages en masse sans risque de blocage, répondez instantanément aux prospects et encaissez les paiements automatiquement. Vos ventes tournent même quand vous dormez.": {
      en: "Broadcast bulk messages with zero ban risk, reply instantly to prospects, and collect payments automatically. Your sales keep running even while you sleep.",
      es: "Envía mensajes masivos sin riesgo de bloqueo, responde al instante a prospectos y cobra automáticamente. Tus ventas funcionan incluso mientras duermes.",
      pt: "Envie mensagens em massa sem risco de bloqueio, responda instantaneamente a clientes e receba pagamentos automaticamente. Suas vendas continuam até enquanto você dorme.",
      ar: "أرسل رسائل جماعية بدون مخاطر حظر، ورُد فورياً على العملاء، وحصّل المدفوعات تلقائياً. مبيعاتك تعمل حتى أثناء نومك."
    },
    "Obtenir un Accès Instantané": {
      en: "Get Instant Access",
      es: "Obtener Acceso Instantáneo",
      pt: "Obter Acesso Instantâneo",
      ar: "الحصول على وصول فوري"
    },
    "-50% à Vie": {
      en: "-50% Lifetime",
      es: "-50% de por vida",
      pt: "-50% Vitalício",
      ar: "خصم 50% مدى الحياة"
    },
    "-50% À VIE": {
      en: "-50% LIFETIME",
      es: "-50% DE POR VIDA",
      pt: "-50% VITALÍCIO",
      ar: "خصم 50% مدى الحياة"
    },
    "0% de frais de majoration": {
      en: "0% markup fees",
      es: "0% comisiones añadidas",
      pt: "0% taxas extras",
      ar: "0% رسوم إضافية"
    },
    "Activation immédiate en 2 minutes": {
      en: "Instant activation in 2 minutes",
      es: "Activación inmediata en 2 minutos",
      pt: "Ativação instantânea em 2 minutos",
      ar: "تفعيل فوري في دقيقتين"
    },
    "Coexistence totale de numéro": {
      en: "Full number coexistence",
      es: "Coexistencia total de número",
      pt: "Coexistência total do número",
      ar: "تعايش كامل مع رقمك"
    },
    "Compatible Wave, Orange Money & CB": {
      en: "Compatible with Wave, Mobile Money & Credit Cards",
      es: "Compatible con Wave, Mobile Money y Tarjetas",
      pt: "Compatível com Wave, Mobile Money e Cartões",
      ar: "متوافق مع البطاقات البنكية وMobile Money"
    },
    "Utilisé par + 41 552 entrepreneurs": {
      en: "Used by 41,552+ entrepreneurs",
      es: "Utilizado por más de 41.552 emprendedores",
      pt: "Usado por mais de 41.552 empreendedores",
      ar: "يستخدمه أكثر من 41,552 رائد أعمال"
    },

    // Metrics & Badges
    "+340% de Conversions": {
      en: "+340% Conversions",
      es: "+340% de Conversiones",
      pt: "+340% de Conversões",
      ar: "+340% تحويلات"
    },
    "Ventes automatisées via WhatsApp": {
      en: "Automated sales via WhatsApp",
      es: "Ventas automatizadas por WhatsApp",
      pt: "Vendas automáticas via WhatsApp",
      ar: "مبيعات مؤتمتة عبر واتساب"
    },
    "Zéro Blocage": {
      en: "Zero Ban",
      es: "Cero Bloqueos",
      pt: "Zero Bloqueios",
      ar: "صفر حظر"
    },
    "Protection anti-bannissement native": {
      en: "Native anti-ban protection",
      es: "Protección anti-bloqueo nativa",
      pt: "Proteção anti-bloqueio nativa",
      ar: "حماية أصلية ضد الحظر"
    },
    "< 3 secondes": {
      en: "< 3 seconds",
      es: "< 3 segundos",
      pt: "< 3 segundos",
      ar: "أقل من 3 ثوانٍ"
    },
    "Temps de réponse de l'IA": {
      en: "AI response time",
      es: "Tiempo de respuesta de la IA",
      pt: "Tempo de resposta da IA",
      ar: "سرعة استجابة الذكاء الاصطناعي"
    },
    "24/7 Autonome": {
      en: "24/7 Autonomous",
      es: "24/7 Autónomo",
      pt: "24/7 Autônomo",
      ar: "24/7 مستقل تماماً"
    },
    "Ventes non-stop même la nuit": {
      en: "Non-stop sales day and night",
      es: "Ventas sin parar día y noche",
      pt: "Vendas sem parar dia e noite",
      ar: "مبيعات متواصلة ليلاً ونهاراً"
    },

    // Features Section
    "FONCTIONNALITÉS CLÉS": {
      en: "KEY FEATURES",
      es: "FUNCIONES CLAVE",
      pt: "RECURSOS PRINCIPAIS",
      ar: "الميزات الرئيسية"
    },
    "Pourquoi les Meilleurs Vendeurs Choisissent VANDIA": {
      en: "Why Top Sellers Choose VANDIA",
      es: "Por Qué los Mejores Vendedores Eligen VANDIA",
      pt: "Por Que os Melhores Vendedores Escolhem a VANDIA",
      ar: "لماذا يختار أفضل البائعين فانديا"
    },
    "Gérer manuellement des dizaines de discussions quotidiennes est le premier frein à la croissance de votre business.": {
      en: "Manually managing dozens of daily chats is the biggest bottleneck to your business growth.",
      es: "Gestionar manualmente decenas de chats diarios es el mayor freno para el crecimiento de tu negocio.",
      pt: "Gerir manualmente dezenas de conversas diárias é o maior obstáculo ao crescimento do seu negócio.",
      ar: "إدارة عشرات المحادثات يومياً يدوياً هي العائق الأكبر أمام نمو أعمالك."
    },
    "IA Conversationnelle 24/7": {
      en: "24/7 Conversational AI",
      es: "IA Conversacional 24/7",
      pt: "IA Conversacional 24/7",
      ar: "ذكاء اصطناعي تفاعلي 24/7"
    },
    "Diffusion Massive Sécurisée": {
      en: "Secure Bulk Broadcasting",
      es: "Difusión Masiva Segura",
      pt: "Disparo em Massa Seguro",
      ar: "بث رسائل جماعي آمن"
    },
    "Encaissement Automatique": {
      en: "Automated Payments",
      es: "Cobro Automático",
      pt: "Pagamentos Automáticos",
      ar: "تحصيل مدفوعات تلقائي"
    },
    "Gestion Multi-Agents & CRM": {
      en: "Multi-Agent & CRM Management",
      es: "Gestión Multi-Agente y CRM",
      pt: "Gestão Multi-Agentes e CRM",
      ar: "إدارة متعددة الوكلاء وCRM"
    },
    "Relances Intelligentes": {
      en: "Smart Follow-ups",
      es: "Reactivación Inteligente",
      pt: "Reengajamento Inteligente",
      ar: "إعادة استهداف ذكية"
    },
    "Statistiques en Temps Réel": {
      en: "Real-Time Analytics",
      es: "Estadísticas en Tiempo Real",
      pt: "Estatísticas em Tempo Real",
      ar: "تحليلات في الوقت الفعلي"
    },

    // Pricing Section
    "TARIFS TRANSPARENTS": {
      en: "TRANSPARENT PRICING",
      es: "PRECIOS TRANSPARENTES",
      pt: "PLANOS TRANSPARENTES",
      ar: "أسعار شفافة"
    },
    "Des Tarifs Clairs, Rentabilisés dès le Premier Jour": {
      en: "Clear Pricing, Profitable from Day One",
      es: "Precios Claros, Rentables Desde el Primer Día",
      pt: "Planos Transparentes, Lucrativos Desde o Primeiro Dia",
      ar: "أسعار واضحة، ومربحة من اليوم الأول"
    },
    "Facturation Mensuelle": {
      en: "Monthly Billing",
      es: "Facturación Mensual",
      pt: "Faturamento Mensal",
      ar: "فاتورة شهرية"
    },
    "Facturation Annuelle": {
      en: "Annual Billing",
      es: "Facturación Anual",
      pt: "Faturamento Anual",
      ar: "فاتورة سنوية"
    },
    "/mois": {
      en: "/month",
      es: "/mes",
      pt: "/mês",
      ar: "/شهرياً"
    },
    "Démarrer l'essai 7 jours gratuits": {
      en: "Start 7-day free trial",
      es: "Comenzar prueba gratuita de 7 días",
      pt: "Começar teste grátis de 7 dias",
      ar: "ابدأ التجربة المجانية لمدة 7 أيام"
    },
    "Choisir ce Plan": {
      en: "Choose this Plan",
      es: "Elegir este Plan",
      pt: "Escolher este Plano",
      ar: "اختيار هذه الخطة"
    },
    "Plan Starter": {
      en: "Starter Plan",
      es: "Plan Starter",
      pt: "Plano Starter",
      ar: "خطة المبتدئين"
    },
    "Plan Pro": {
      en: "Pro Plan",
      es: "Plan Pro",
      pt: "Plano Pro",
      ar: "الخطة الاحترافية"
    },
    "Plan Scale": {
      en: "Scale Plan",
      es: "Plan Scale",
      pt: "Plano Scale",
      ar: "خطة التوسع"
    },

    // FAQ Section
    "QUESTIONS FRÉQUENTES": {
      en: "FREQUENTLY ASKED QUESTIONS",
      es: "PREGUNTAS FRECUENTES",
      pt: "PERGUNTAS FREQUENTES",
      ar: "الأسئلة الشائعة"
    },
    "Tout Ce Que Vous Devez Savoir Avant de Démarrer": {
      en: "Everything You Need to Know Before Getting Started",
      es: "Todo lo que Necesitas Saber Antes de Empezar",
      pt: "Tudo o que Precisa de Saber Antes de Começar",
      ar: "كل ما تحتاج إلى معرفته قبل البدء"
    },
    "Mon numéro peut-il être bloqué par WhatsApp ?": {
      en: "Can my phone number be blocked by WhatsApp?",
      es: "¿Puede ser bloqueado mi número por WhatsApp?",
      pt: "O meu número pode ser bloqueado pelo WhatsApp?",
      ar: "هل يمكن أن يحظر واتساب رقم هاتفي؟"
    },
    "Puis-je continuer à utiliser mon WhatsApp personnellement ?": {
      en: "Can I keep using my WhatsApp personally?",
      es: "¿Puedo seguir usando mi WhatsApp de forma personal?",
      pt: "Posso continuar a usar o meu WhatsApp pessoalmente?",
      ar: "هل يمكنني الاستمرار في استخدام واتساب شخصياً؟"
    },
    "Quels sont les moyens de paiement acceptés pour mes clients ?": {
      en: "What payment methods are supported for my customers?",
      es: "¿Qué métodos de pago son aceptados para mis clientes?",
      pt: "Quais métodos de pagamento são aceitos para meus clientes?",
      ar: "ما هي وسائل الدفع المقبولة لعملائي؟"
    },
    "Comment configurer l'IA avec mes propres produits ?": {
      en: "How do I configure the AI with my own products?",
      es: "¿Cómo configurar la IA con mis propios productos?",
      pt: "Como configurar a IA com meus próprios produtos?",
      ar: "كيف أقوم بضبط الذكاء الاصطناعي مع منتجاتي؟"
    },

    // Auth Modal
    "Créer un compte": {
      en: "Create Account",
      es: "Crear Cuenta",
      pt: "Criar Conta",
      ar: "إنشاء حساب"
    },
    "Se connecter": {
      en: "Sign In",
      es: "Iniciar Sesión",
      pt: "Entrar",
      ar: "تسجيل الدخول"
    },
    "Prénom": {
      en: "First Name",
      es: "Nombre",
      pt: "Primeiro Nome",
      ar: "الاسم الأول"
    },
    "Nom": {
      en: "Last Name",
      es: "Apellido",
      pt: "Sobrenome",
      ar: "اسم العائلة"
    },
    "Adresse e-mail professionnelle": {
      en: "Work Email Address",
      es: "Correo Electrónico Profesional",
      pt: "E-mail Profissional",
      ar: "البريد الإلكتروني للعمل"
    },
    "Numéro WhatsApp (avec indicatif)": {
      en: "WhatsApp Number (with country code)",
      es: "Número de WhatsApp (con prefijo)",
      pt: "Número de WhatsApp (com DDI)",
      ar: "رقم واتساب (مع الرمز الدولي)"
    },
    "Mot de passe": {
      en: "Password",
      es: "Contraseña",
      pt: "Palavra-passe",
      ar: "كلمة المرور"
    },
    "Confirmer": {
      en: "Confirm",
      es: "Confirmar",
      pt: "Confirmar",
      ar: "تأكيد"
    },
    "Min. 8 caractères": {
      en: "Min. 8 characters",
      es: "Mín. 8 caracteres",
      pt: "Mín. 8 caracteres",
      ar: "8 أحرف على الأقل"
    },
    "Répéter mot de passe": {
      en: "Repeat password",
      es: "Repetir contraseña",
      pt: "Repetir palavra-passe",
      ar: "تكرار كلمة المرور"
    },
    "Créer mon compte VANDIA (-50% à Vie)": {
      en: "Create my VANDIA account (-50% Lifetime)",
      es: "Crear mi cuenta VANDIA (-50% de por vida)",
      pt: "Criar minha conta VANDIA (-50% Vitalício)",
      ar: "إنشاء حسابي في فانديا (-50% مدى الحياة)"
    },
    "Se connecter à VANDIA AI": {
      en: "Sign in to VANDIA AI",
      es: "Iniciar sesión en VANDIA AI",
      pt: "Entrar no VANDIA AI",
      ar: "تسجيل الدخول إلى فانديا"
    },
    "Déjà un compte VANDIA ?": {
      en: "Already have a VANDIA account?",
      es: "¿Ya tienes cuenta en VANDIA?",
      pt: "Já tem uma conta VANDIA?",
      ar: "هل لديك حساب بالفعل في فانديا؟"
    },
    "Pas encore de compte ?": {
      en: "Don't have an account yet?",
      es: "¿Aún no tienes cuenta?",
      pt: "Ainda não tem uma conta?",
      ar: "ليس لديك حساب بعد؟"
    },
    "S'inscrire gratuitement": {
      en: "Sign up for free",
      es: "Registrarse gratis",
      pt: "Cadastrar-se grátis",
      ar: "سجل مجاناً"
    },
    "Mot de passe oublié ?": {
      en: "Forgot password?",
      es: "¿Olvidaste tu contraseña?",
      pt: "Esqueceu-se da senha?",
      ar: "نسيت كلمة المرور؟"
    },

    // Footer
    "Plateforme SaaS d'Automatisation Commerciale WhatsApp IA pour l'Afrique et l'International.": {
      en: "WhatsApp AI Sales Automation SaaS Platform for Africa and Global Markets.",
      es: "Plataforma SaaS de Automatización de Ventas por WhatsApp IA para África y el Mundo.",
      pt: "Plataforma SaaS de Automação de Vendas no WhatsApp IA para a África e o Mundo.",
      ar: "منصة ساس لأتمتة مبيعات واتساب بالذكاء الاصطناعي لأفريقيا والعالم."
    },
    "Tous droits réservés.": {
      en: "All rights reserved.",
      es: "Todos los derechos reservados.",
      pt: "Todos os direitos reservados.",
      ar: "جميع الحقوق محفوظة."
    }
  };

  class VendiaI18nEngine {
    constructor() {
      this.currentLang = 'fr';
      this.originalTexts = new WeakMap();
      this.originalPlaceholders = new WeakMap();
    }

    init() {
      const saved = localStorage.getItem('vendia_lang') || 'fr';
      this.setLanguage(saved, false);
      this.bindEvents();
    }

    bindEvents() {
      document.addEventListener('click', (e) => {
        const item = e.target.closest('.lang-option-item');
        if (item && item.dataset.lang) {
          e.preventDefault();
          this.setLanguage(item.dataset.lang, true);
        }
      });
    }

    setLanguage(langCode, save = true) {
      if (!VENDIA_LANGUAGES[langCode]) langCode = 'fr';
      this.currentLang = langCode;
      if (save) localStorage.setItem('vendia_lang', langCode);

      // Update HTML lang and direction
      const langMeta = VENDIA_LANGUAGES[langCode];
      document.documentElement.lang = langCode;
      document.documentElement.dir = langMeta.dir || 'ltr';

      // Update UI buttons and options
      this.updateUI(langCode);

      // Translate DOM
      this.translateDOM(langCode);

      // Dispatch event
      window.dispatchEvent(new CustomEvent('vendia:langchange', { detail: { lang: langCode } }));
    }

    updateUI(langCode) {
      const lang = VENDIA_LANGUAGES[langCode] || VENDIA_LANGUAGES.fr;
      const wraps = document.querySelectorAll('.lang-selector-dropdown-wrap');
      wraps.forEach(wrap => {
        const flagImg = wrap.querySelector('.lang-flag-img');
        const codeSpan = wrap.querySelector('.lang-current-code');
        if (flagImg) flagImg.src = lang.flag;
        if (codeSpan) codeSpan.textContent = lang.code;

        const items = wrap.querySelectorAll('.lang-option-item');
        items.forEach(item => {
          if (item.dataset.lang === langCode) {
            item.classList.add('active');
          } else {
            item.classList.remove('active');
          }
        });
      });
    }

    translateDOM(langCode) {
      const isFrench = langCode === 'fr';

      // Walk text nodes
      const walk = (node) => {
        if (node.nodeType === 3) {
          const raw = node.nodeValue;
          const trimmed = raw.trim();
          if (!trimmed) return;

          if (!this.originalTexts.has(node)) {
            this.originalTexts.set(node, raw);
          }

          const original = this.originalTexts.get(node);
          const origTrimmed = original.trim();

          if (isFrench) {
            node.nodeValue = original;
          } else if (DICTIONARY[origTrimmed] && DICTIONARY[origTrimmed][langCode]) {
            node.nodeValue = original.replace(origTrimmed, DICTIONARY[origTrimmed][langCode]);
          }
        } else if (node.nodeType === 1) {
          const tag = node.tagName.toUpperCase();
          if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME'].includes(tag)) return;
          // Do not translate inside country select options
          if (node.classList && (node.classList.contains('country-code-select') || node.classList.contains('lang-dropdown-menu'))) return;

          // Placeholder translation
          if (node.hasAttribute('placeholder')) {
            if (!this.originalPlaceholders.has(node)) {
              this.originalPlaceholders.set(node, node.getAttribute('placeholder'));
            }
            const origPl = this.originalPlaceholders.get(node);
            const plTrimmed = origPl.trim();
            if (isFrench) {
              node.setAttribute('placeholder', origPl);
            } else if (DICTIONARY[plTrimmed] && DICTIONARY[plTrimmed][langCode]) {
              node.setAttribute('placeholder', DICTIONARY[plTrimmed][langCode]);
            }
          }

          if (node.childNodes && node.childNodes.length) {
            node.childNodes.forEach(walk);
          }
        }
      };

      walk(document.body);
    }
  }

  const engine = new VendiaI18nEngine();
  window.VendiaI18n = engine;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => engine.init());
  } else {
    engine.init();
  }

})(window);
