// Sample emails for trying localsort without signing in. Synthetic (from the training generator) — no real mail.
import type { Mail } from "./graph";

const raw: [string, string, string, string, { name: string; value: string }[]?][] = [
  ["مصرف الراجحي", "alrajhibank@alrajhi-secure.com", "تحديث عاجل لبيانات حسابك البنكي", "عزيزنا العميل، تم رصد محاولة دخول غير مصرح بها على حسابك. للحفاظ على أموالك، تحتاج تحديث معلومات الدخول فوراً عبر الرابط المرفق. عدم الاستجابة سيؤدي لتجميد الحساب."],
  ["Laura Chen", "laura.chen@horizonstaffing.com", "Re: Data Scientist — remote, $185K base", "Following up on my note from last week. The hiring manager reviewed your LinkedIn and wants to move forward. Are you free Thursday or Friday for an intro call?"],
  ["Al Rajhi Bank", "alrajhibank@alrajhibank.com.sa", "تفعيل خدمة الإشعارات الرسائلية لحسابك الجاري", "عميلنا الكريم، نود تأكيد تفعيل خدمة الإشعارات الرسائلية لحسابك الجاري رقم ****1234. ستتلقى الآن إشعارات فورية عبر الرسائل النصية والبريد الإلكتروني لأي حركة تتم على حسابك."],
  ["System Admin", "noreply@email-secure.us", "Your Mailbox is Pending Review", "Your mailbox is currently pending a security review. To avoid any potential issues, please log in and confirm your account details within the next 24 hours.",
    [{ name: "Authentication-Results", value: "spf=fail smtp.mailfrom=email-secure.us; dkim=none; dmarc=fail action=none header.from=email-secure.us" }]],
  ["Careem", "noreply@careem.com", "Careem Plus subscription activated", "Ahlan Khalid, your Careem Plus membership is confirmed. You'll enjoy free delivery on food orders over 15 JOD. Billing renews monthly at 9.99 JOD."],
  ["Netflix", "billing@netflix.com", "Your Netflix password was changed", "We're just confirming that your Netflix password was changed on Nov 2. If you didn't request this, please visit netflix.com/security to reset your password."],
  ["Janice Wong", "janice.wong@propertymgmt.com", "Re: My apt has roaches", "Hi, I've forwarded your request to our pest control specialist. They will contact you directly to set up an appointment. Please expect a call soon."],
  ["Citi", "offers@citi.com", "Pre-qualified: Citi Double Cash® — 2% on everything", "You've been pre-qualified for the Citi Double Cash® Card. Earn 2% cash back on all purchases. Checking your offer won't affect your credit score."],
  ["IKEA UAE", "care@ikea.ae", "تحديث طلب ايكيا #AEIKEA12345 - تم شحن الطلب", "أهلاً يا مي، تم شحن طلبك من ايكيا رقم AEIKEA12345. رقم التتبع: IKEA-SHIP-6789. سيتم توصيل الأثاث خلال الأيام القادمة."],
  ["PayPal Service", "service@paypa1-support.com", "Your account has been limited", "We noticed unusual activity. Your account access is limited until you confirm your identity. Click here within 24 hours to verify your card."],
  ["MyFitnessPal", "stats@myfitnesspal.com", "Weekly Progress: You logged 6 of 7 days", "Your average daily calories were 2,140 and you hit your protein goal 4 times. Log today's dinner to keep your streak alive."],
  ["IT Policy Committee", "policy@globaltech.com", "Reminder: Q2 IT Policy Compliance Training Deadline Approaching", "Dear Employee, this is a friendly reminder that the deadline for completing your mandatory Q2 IT Policy Compliance Training is Friday, June 11th."],
  ["Careem", "offers@careem.com", "للسفر براحة أكثر: ترقية Careem Plus بانتظارك!", "لم يتبقى سوى يومين لتستفيد من مزايا Careem Plus المجانية. جدد اشتراكك..."],
  ["Cozi", "reminders@cozi.com", "Reminder: Mike's birthday party this Saturday", "Just a heads up — Mike Lawson's birthday party is this Saturday at 4:00 PM. Let us know if you can make it."],
];

export const demoInbox = (): Mail[] =>
  raw.map(([fromName, fromAddr, subject, preview, headers], i) => ({
    id: `demo-${i}`, subject, preview, fromName, fromAddr, received: new Date(Date.now() - i * 3.6e6).toISOString(),
    categories: [], headers: headers ?? [],
  }));
