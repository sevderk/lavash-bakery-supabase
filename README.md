# 🫓 Lavash Bakery Management System

> **A mobile-first solution for production planning and debt tracking, replacing complex Excel sheets.**

This project is designed for a flatbread (lavash) bakery to streamline daily orders, production planning, distribution, and current account (debt/credit) tracking via a mobile application.

![Project Status](https://img.shields.io/badge/Status-Completed-success)
![Tech Stack](https://img.shields.io/badge/React_Native-Expo-blue)
![Backend](https://img.shields.io/badge/Backend-Supabase-green)

> [📱 Download APK (v1.0)](https://github.com/sevderk/lavash-bakery-supabase/releases/download/v1.0.0/application-1920b48b-2c35-497b-a3ca-544d9a988707.apk)

---

## 🎯 Purpose & Key Solutions

Traditional methods (paper, notebooks, or scattered Excel files) often lead to data loss and inefficiencies. This app solves the following problems:
* ❌ Inability to view instant customer balances.
* ❌ Time-consuming daily production calculations.
* ❌ Lost or confused paper orders.
* ❌ Difficulty in tracking payments and delivery statuses.

**With This System:**
* ✅ **Real-time Balance:** Customer debt updates instantly upon order entry; balance decreases upon payment.
* ✅ **Production Planning:** View total daily production requirements with a single tap.
* ✅ **Mobility:** The business owner manages the entire operation from a smartphone.

---

## 🚀 Key Features

### 1. Customer Management (CRM)
* **Contacts Integration:** Import customers directly from the phone's contact list.
* **CRUD Operations:** Add, edit, and delete customers (Safe Delete: Customers with transaction history cannot be deleted to preserve data integrity).
* **Visual Balance:** Color-coded balances (Red for Debt, Green for Paid).

### 2. Smart Order System
* **Bulk Order Entry:** Quickly enter quantities for multiple customers on a single screen.
* **Draft Mode:** Orders are saved locally (Zustand Persistence) even if the app closes, preventing data loss.
* **Auto-Calculation:** Total amounts are calculated automatically based on unit price.

### 3. Finance & Accounting
* **Database Triggers:** SQL Triggers automatically manage balance updates in the background.
* **Partial Payments:** Track partial payments and view detailed transaction history.
* **Status Automation:** Orders are marked as "Paid" automatically when the balance reaches zero.

### 4. Reporting & Exporting
* **Excel Export:** Generate and share daily distribution lists in `.xlsx` format.
* **WhatsApp Summary:** Copy a text-based summary of the distribution list to share with drivers.
* **Dashboard:** View
