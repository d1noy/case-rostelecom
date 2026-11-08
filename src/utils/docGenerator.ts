import { CompanyItem } from '../data/mockData';

export function generateCommercialOfferDoc(company: CompanyItem): void {
  const currentDate = new Date().toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const offerNumber = `РТК-КП-${company.id}-${new Date().getFullYear()}`;
  const mrrFormatted = new Intl.NumberFormat('ru-RU').format(company.potential_deal_rub);
  const arrFormatted = new Intl.NumberFormat('ru-RU').format(company.potential_deal_rub * 12);

  // Microsoft Word compatible HTML document
  const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>Коммерческое предложение Ростелеком</title>
      <style>
        body {
          font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
          color: #222222;
          line-height: 1.5;
          margin: 40px;
        }
        .header-table {
          width: 100%;
          border-bottom: 3px solid #7700FF;
          padding-bottom: 15px;
          margin-bottom: 25px;
        }
        .rtk-logo {
          font-size: 24px;
          font-weight: bold;
          color: #7700FF;
          letter-spacing: 1px;
        }
        .rtk-subtitle {
          font-size: 12px;
          color: #555555;
          text-transform: uppercase;
        }
        .doc-meta {
          font-size: 13px;
          color: #666666;
          text-align: right;
        }
        .recipient-box {
          background-color: #f8f9fa;
          border-left: 4px solid #FF4F12;
          padding: 12px 18px;
          margin-bottom: 25px;
          font-size: 13px;
        }
        h1 {
          font-size: 18px;
          color: #1a1a1a;
          text-align: center;
          margin: 20px 0;
          text-transform: uppercase;
        }
        p {
          font-size: 14px;
          margin-bottom: 12px;
          text-align: justify;
        }
        table.service-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          font-size: 13px;
        }
        table.service-table th {
          background-color: #7700FF;
          color: #ffffff;
          padding: 10px;
          border: 1px solid #7700FF;
          text-align: left;
        }
        table.service-table td {
          padding: 10px;
          border: 1px solid #dddddd;
        }
        .highlight-row {
          background-color: #fdf5f2;
          font-weight: bold;
        }
        .conditions-box {
          background-color: #fbfbfe;
          border: 1px solid #e0e0e0;
          padding: 14px;
          margin: 20px 0;
          font-size: 13px;
        }
        .signature-block {
          margin-top: 40px;
          width: 100%;
        }
        .footer-note {
          margin-top: 30px;
          font-size: 11px;
          color: #888888;
          border-top: 1px solid #eeeeee;
          padding-top: 10px;
        }
      </style>
    </head>
    <body>
      <table class="header-table">
        <tr>
          <td>
            <div class="rtk-logo">РОСТЕЛЕКОМ</div>
            <div class="rtk-subtitle">Департамент корпоративного и государственного сегмента</div>
          </td>
          <td class="doc-meta">
            <div><b>Исх. №:</b> ${offerNumber}</div>
            <div><b>Дата:</b> ${currentDate}</div>
            <div><b>Город:</b> г. ${company.city}</div>
          </td>
        </tr>
      </table>

      <div class="recipient-box">
        <b>Руководству компании:</b> ${company.name}<br>
        <b>ИНН / ОГРН:</b> ${company.inn} / ${company.ogrn}<br>
        <b>Отрасль деятельности:</b> ${company.industry}<br>
        <b>Контактный телефон:</b> ${company.contact_phone}
      </div>

      <h1>КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ</h1>
      <p style="text-align: center; color: #555; font-size: 13px; margin-top: -10px;">
        на предоставление телекоммуникационных и цифровых сервисов для бизнеса
      </p>

      <p><b>Уважаемые партнеры!</b></p>
      <p>
        ПАО «Ростелеком» выражает свое почтение и представляет специальное пакетное решение для обеспечения 
        бесперебойной цифровой инфраструктуры Вашего предприятия. На основе гео-аналитики корпоративного сектора 
        в регионе <b>${company.region_name}</b> мы подготовили оптимизированное предложение с приоритетным SLA:
      </p>

      <table class="service-table">
        <thead>
          <tr>
            <th>№</th>
            <th>Наименование сервиса</th>
            <th>Характеристики / Пакет</th>
            <th>Срок развертывания</th>
            <th>Ежемесячный платеж</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td><b>${company.recommended_service}</b></td>
            <td>Оптический ввод, гарантированная полоса, резервирование маршрутов</td>
            <td>до 5 рабочих дней</td>
            <td>${mrrFormatted} ₽</td>
          </tr>
          <tr>
            <td>2</td>
            <td>Виртуальная АТС и номер 8-800</td>
            <td>Многоканальная запись звонков, интеграция с CRM, голосовое меню IVR</td>
            <td>1 рабочий день</td>
            <td>Включено в пакет</td>
          </tr>
          <tr>
            <td>3</td>
            <td>Защищенная корпоративная сеть (VPN)</td>
            <td>Шифрование трафика, связность с филиалами, защита периметра</td>
            <td>до 3 рабочих дней</td>
            <td>Включено в пакет</td>
          </tr>
          <tr class="highlight-row">
            <td colspan="4" style="text-align: right;">ИТОГО ЕЖЕМЕСЯЧНО (MRR):</td>
            <td style="color: #FF4F12; font-size: 15px;">${mrrFormatted} ₽/мес</td>
          </tr>
          <tr class="highlight-row">
            <td colspan="4" style="text-align: right;">ОБЪЕМ КОНТРАКТА В ГОД (ARR):</td>
            <td style="color: #7700FF; font-size: 15px;">~${arrFormatted} ₽/год</td>
          </tr>
        </tbody>
      </table>

      <div class="conditions-box">
        <b>Преимущества подключения к ПАО «Ростелеком»:</b>
        <ul>
          <li><b>SLA 99.95%:</b> круглосуточная служба поддержки и гарантированное время восстановления связи не более 2 часов.</li>
          <li><b>Верифицированная безопасность:</b> соответствие требованиям регуляторов (152-ФЗ, ГОСТ-шифрование).</li>
          <li><b>Персональный менеджер:</b> выделенный куратор проекта в регионе ${company.region_name}.</li>
          <li><b>Срок действия коммерческого предложения:</b> 30 календарных дней с момента формирования.</li>
        </ul>
      </div>

      <table class="signature-block">
        <tr>
          <td style="width: 60%;">
            <b>Коммерческий директор сегмента B2B</b><br>
            ПАО «Ростелеком»
          </td>
          <td style="width: 40%; text-align: right;">
            <div style="border-bottom: 1px solid #333; width: 180px; display: inline-block; height: 30px;"></div><br>
            <span style="font-size: 12px; color: #777;">Иванов И.И. / Подпись</span>
          </td>
        </tr>
      </table>

      <div class="footer-note">
        Документ сформирован автоматически аналитической системой «Радар присутствия» коммерческого блока ПАО «Ростелеком».
        Данные верифицированы по государственным реестрам ФНС России (ИНН ${company.inn}).
      </div>
    </body>
    </html>
  `;

  // Create Blob with Word MIME type
  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = `KP_Rostelecom_${company.inn}_${company.name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}.doc`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}
