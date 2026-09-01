---
description: Aturan wajib untuk selalu mem-push perubahan kode ke GitHub.
scope: global
---

# Auto Git Push

Selalu ingat aturan berikut saat bekerja di repositori NEXA:
1. Setiap kali Anda (sebagai AI) selesai melakukan satu set perubahan pada kode (seperti refactoring, menambah fitur, atau memperbaiki bug), Anda **DIWAJIBKAN** untuk langsung melakukan `git add`, `git commit -m "[pesan_deskriptif]"`, dan `git push` tanpa harus menunggu diminta oleh pengguna.
2. Tugas ini harus dilakukan secara otomatis di akhir pengerjaan, sebelum Anda merespons bahwa tugas telah selesai.
3. Karena menggunakan Windows PowerShell, selalu ingat untuk menggunakan pemisah ` ; ` saat menggabungkan command (contoh: `git add . ; git commit -m "update" ; git push`).
