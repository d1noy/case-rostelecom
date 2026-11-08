import { CompanyItem } from '../data/mockData';

export function generateCommercialOfferDoc(company: CompanyItem): void {
    const dateStr = new Date().toLocaleDateString('ru-RU');

    const content = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Коммерческое предложение ПАО «Ростелеком»</title>
<style>
  body { font-family: 'Calibri', 'Arial', sans-serif; color: #1e293b; line-height: 1.5; padding: 30px; }
  .header { border-bottom: 3px solid #7700ff; padding-bottom: 15px; margin-bottom: 25px; }
  .title { font-size: 20pt; font-weight: bold; color: #7700ff; margin-bottom: 5px; }
  .subtitle { font-size: 13pt; color: #64748b; }
  .target-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin: 20px 0; }
  .services-list { margin: 15px 0 25px 20px; }
  .footer { margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 15px; font-size: 10pt; color: #64748b; }
  .badge { display: inline-block; padding: 4px 10px; background: #ff4f12; color: #fff; border-radius: 4px; font-weight: bold; font-size: 10pt; }
</style>
</head>
<body>
  <div class="header">
    <div class="title">ПАО «РОСТЕЛЕКОМ» • КОРПОРАТИВНЫЕ РЕШЕНИЯ</div>
    <div class="subtitle">Индивидуальное коммерческое предложение для цифровой трансформации бизнеса</div>
  </div>

  <div class="target-box">
    <b>Клиент:</b> ${company.name}<br>
    <b>ИНН:</b> ${company.inn} | <b>Отрасль:</b> ${company.industry}<br>
    <b>Контактное лицо:</b> ${company.contact_person || 'Руководителю ИТ/Инфраструктуры'}<br>
    <b>Дата формирования:</b> ${dateStr}<br>
    <b>Статус проработки в Радаре присутствия:</b> <span class="badge">Приоритетный лид (Белое пятно)</span>
  </div>

  <h3>Уважаемые коллеги!</h3>
  <p>
    ПАО «Ростелеком» на основе аналитики платформы «Радар присутствия» сформировало для предприятия <b>«${company.name}»</b>
    пакет высоконадежных телекоммуникационных и цифровых сервисов с гарантированным SLA 99.98%:
  </p>

  <h4>Рекомендуемые сервисы для развертывания:</h4>
  <ul class="services-list">
    ${company.suggested_services.map(s => `<li><b>${s}</b> — подключение по резервированной ВОЛС с защитой Solar JSOC.</li>`).join('\n')}
  </ul>

  <h4>Ключевые преимущества партнерства с Ростелеком:</h4>
  <ul>
    <li>Собственная опорная магистральная сеть и прямое включение в крупнейшие точки обмена трафиком РФ;</li>
    <li>Круглосуточный мониторинг инцидентов NOC/SOC 24/7/365;</li>
    <li>Соответствие 152-ФЗ, аттестация по требованиям ФСТЭК / ФСБ;</li>
    <li>Персональный аккаунт-менеджер и гибкие финансовые условия оплаты.</li>
  </ul>

  <div class="footer">
    ПАО «Ростелеком» • Департамент по работе с корпоративным и государственным сегментом.<br>
    Электронный адрес: b2b@rt.ru • Единый контактный центр: 8 800 200 3000
  </div>
</body>
</html>
  `.trim();

    const blob = new Blob([content], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KP_Rostelecom_${company.name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
