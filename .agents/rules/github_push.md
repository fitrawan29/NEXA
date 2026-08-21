---
trigger: always_on
---

# GitHub Push Rule

Setiap kali Anda (agent) melakukan modifikasi atau pembaruan pada file `code.gs` atau `index.html` (atau file utama lainnya di repositori ini), Anda WAJIB melakukan `git add`, `git commit -m "[Pesan Commit]"`, dan `git push origin main` segera setelah selesai melakukan perubahan. 

Pastikan repositori lokal selalu tersinkronisasi dengan GitHub untuk mencegah error `fatal: cannot lock ref` atau `non-fast-forward`.
