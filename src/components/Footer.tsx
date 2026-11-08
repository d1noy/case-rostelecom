import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-col">
          <div className="logo-wrapper">
            <span className="logo-text" style={{ color: '#fff' }}>
              Экосистема коммерческого блока
            </span>
          </div>
          <p className="footer-desc">
            Решения для управления регионами и отраслевой аналитикой ПАО «Ростелеком»
          </p>
        </div>

        <div className="footer-col">
          <h3 className="footer-title">Навигация</h3>
          <ul className="footer-links">
            <li><a href="#radar">Панель управления (Радар)</a></li>
            <li><a href="#navigator">Инвестиционный навигатор</a></li>
            <li><a href="#calculator">Калькулятор сделок</a></li>
            <li><a href="#analytics">Отраслевая аналитика</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h3 className="footer-title">Контакты</h3>
          <ul className="footer-links">
            <li><a href="mailto:support@rostelecom.ru">support@rostelecom.ru</a></li>
            <li>Внутренний портал команды</li>
            <li>Чат проекта в SourceCraft</li>
          </ul>
        </div>

        <div className="footer-col">
          <h3 className="footer-title">Правовые ссылки</h3>
          <ul className="footer-links">
            <li><a href="#privacy">Политика конфиденциальности</a></li>
            <li><a href="#terms">Условия использования</a></li>
          </ul>
        </div>

        <div className="copyright">
          &copy; {new Date().getFullYear()} Ростелеком. Все права защищены.
        </div>
      </div>
    </footer>
  );
};
