# KAMANJAMIX VIDEO STUDIO (نسخة احتياطية مستقلة)

## التشغيل
1. فك الضغط.
2. افتح `index.html` بمتصفح حديث (Chrome أو Edge يُنصح بهما). لا يلزم خادم ولا إنترنت ولا حساب.
3. بديل: الملف المنفرد `kamanjamix-video-studio-standalone.html` يحتوي كل شيء في ملف واحد.

## الهيكل
- `index.html`: الواجهة.
- `css/style.css`: الأنماط.
- `js/01-engine-audio-stage.js`: الصوت (Web Audio)، المسرح، الكاميرا الأساسية، التسجيل.
- `js/02-motion-camera-webgl.js`: حركة المغنية (WebGL)، الكاميرا المتقدمة، الجمهور والمؤثرات.
- `js/03-head-mouth-panel.js`: لوحة AI Singer Head & Mouth Motion (نقطتا الفم والرقبة، المعاينة).
- `js/04-particles-visualizer.js`: الجزيئات، الموجات الصوتية، عرض الصورة الكاملة، التصدير.

ترتيب تحميل ملفات JS مهم ويجب ألا يتغير (كلها في نطاق عام مشترك).

## الاعتماديات
لا توجد مكتبات خارجية ولا روابط CDN ولا خدمات. التطبيق يستعمل واجهات المتصفح فقط: Canvas وWebGL وWeb Audio وMediaRecorder.

## ملاحظات
- التصدير يسجّل بصيغة WebM بالوقت الحقيقي، ويحتاج متصفحاً يدعم MediaRecorder.
- الكشف التلقائي عن الوجه يعمل فقط إن وفّر المتصفح واجهة FaceDetector، وإلا حدّد نقطتي الفم والرقبة يدوياً.
- لربط نموذج وجه محلي لاحقاً: عرّف `window.KMX_FACE_PROVIDER.detect(canvas)` ليعيد `{mouth:{x,y}, neck:{x,y}}` بإحداثيات من 0 إلى 1.
