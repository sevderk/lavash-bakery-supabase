# 🫓 Lavash Bakery Management System (Advanced ERP Edition)

> **A mobile-first, comprehensive solution for production planning, multi-product ordering, and advanced debt tracking.**

This project is designed for a flatbread (lavash) bakery to streamline daily operations, replacing scattered Excel sheets and paper notebooks with a robust, real-time mobile application. Following recent architectural upgrades, it now serves as a full-fledged mini-ERP system handling stock, custom discounts, and professional PDF reporting.

![Project Status](https://img.shields.io/badge/Status-Production_Ready-success)
![Tech Stack](https://img.shields.io/badge/React_Native-Expo-blue)
![Backend](https://img.shields.io/badge/Backend-Supabase-green)

> [📱 Download APK (v2.0)](https://github.com/sevderk/lavash-bakery-supabase/releases/download/v2.0.0/application-31115cd9-4004-4f40-9275-18dae12dd14c.apk)

## 🎯 Purpose & Key Solutions

Traditional methods often lead to data loss, miscalculated debts, and inefficient production planning. This app solves these problems by providing:
* ✅ **Real-time Balance & Smart Triggers:** Customer debt updates instantly upon order entry or editing. Balances are safely managed entirely via PostgreSQL triggers.
* ✅ **Dynamic Cart System:** Move beyond single-item tracking. Easily add multiple product types (e.g., Lavash, Pide) into a single customer order.
* ✅ **Professional Reporting:** Export daily summaries in both Excel and beautifully styled PDF formats to share with drivers via WhatsApp instantly.
* ✅ **Mobility:** The business owner manages the entire operation, from stock to debt collection, natively from a smartphone.

---

## 🚀 Key Features

### 1. 📦 Product & Stock Management (NEW)
* **Product Catalog:** Full CRUD operations for bakery products with dynamic pricing and stock tracking.
* **Flexible Pricing:** Support for various product types seamlessly integrated into the order flow.

### 2. 🤝 Customer Management (CRM) & Discounts
* **Smart Discounts (NEW):** Assign permanent discount rules per customer (e.g., "%5 Percentage" or "₺1.50 Fixed"). Discounts are auto-calculated at checkout.
* **Contacts Integration:** Import customers directly from the phone's contact list.
* **Visual Balance:** Color-coded balance indicators (Positive/Red for Debt, Negative/Green for Credit/Overpayment).

### 3. 🛒 Advanced Order System
* **Multi-Product Cart (NEW):** A modern modal-based cart system allowing mixed product orders with independent quantities.
* **Order Editing (NEW):** Safely edit past orders. Advanced database triggers calculate the difference and automatically adjust the customer's current balance.
* **Draft Mode:** Orders are saved locally (Zustand Persistence) preventing data loss if the app is closed.

### 4. 💳 Finance & Detailed Payments
* **Granular Tracking (NEW):** Record payments with specific methods (💵 Cash, 💳 Credit Card, 🏦 Bank Transfer).
* **Transaction Notes (NEW):** Add custom descriptions to payments for better accounting.
* **Timeline View:** A clean transaction history timeline displaying order breakdowns (e.g., "100x Lavash, 50x Pide") and payment emojis.

### 5. 📊 Reporting & Exporting
* **PDF Export (NEW):** Generate professional, styled HTML-to-PDF reports with total revenue, item breakdown, and dates.
* **Excel Export:** Generate daily distribution lists in `.xlsx` format.
* **Dashboard:** View daily revenue, total production targets, and active customer metrics.

---

## 🛠️ Tech Stack

* **Frontend:** React Native (Expo Router)
* **Language:** TypeScript
* **Backend & Database:** Supabase (PostgreSQL)
* **State Management:** Zustand (with Persist Middleware)
* **UI Library:** React Native Paper
* **Key Libraries:**
    * `expo-print`: For HTML-to-PDF generation.
    * `expo-contacts`: For contact list integration.
    * `xlsx`: For Excel reporting.
    * `expo-sharing`: For native file sharing.

---

## 📸 Screenshots

<p align="center">
  <img src="https://github.com/user-attachments/assets/6623533a-a6e5-472f-8e3d-4eb01bc2319b" width="180" />
  <img src="https://github.com/user-attachments/assets/48601d0d-509a-4559-b457-9625b13a5da8" width="180" />
</p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/7d416cc2-2522-44b9-b49b-9aa7db24bf2b" width="165" />
  <img src="https://github.com/user-attachments/assets/a964f8bf-770f-4d0c-9e67-47ccde9e5425" width="165" />
  <img src="https://github.com/user-attachments/assets/64ec7d3d-f161-4220-abd5-6ceff8d2d171" width="165" />
  <img src="https://github.com/user-attachments/assets/a745cdda-2150-41d2-b0b5-adb10c931f8d" width="165" />
  <img src="https://github.com/user-attachments/assets/20d26581-c8a8-4fe5-ab89-f6cb5a41f859" width="165" />
  <img src="https://github.com/user-attachments/assets/a217a0fb-dd15-4150-a089-a9adc0b49257" width="165" />
</p>

---

## ⚙️ Installation & Setup

To run this project locally:

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/sevderk/lavash-bakery-supabase.git
    cd lavash-bakery-supabase
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Variables (.env):**
    Create a `.env` file in the root directory and add your Supabase credentials:
    ```env
    EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
    EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Run the App:**
    ```bash
    npx expo start
    ```

---

## 🗄️ Database Structure (Supabase)

The project runs on a robust PostgreSQL schema designed for scalability:

* **`products`:** `id`, `name`, `price`, `stock`
* **`customers`:** `id`, `name`, `phone`, `current_balance`, `discount_type`, `discount_value`
* **`orders`:** `id`, `customer_id`, `total_price`, `date`
* **`order_items`:** `id`, `order_id`, `product_id`, `quantity`, `unit_price`, `total_price`
* **`payments`:** `id`, `customer_id`, `amount`, `payment_method`, `description`, `date`

*Note: The `current_balance` field is managed completely automatically via advanced `AFTER INSERT`, `AFTER UPDATE`, and `AFTER DELETE` SQL Trigger functions.*

---

## 📄 License

This project is licensed under the [MIT](LICENSE) License.
