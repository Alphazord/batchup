# Licenses

**Product:** BatchUp  
**Copyright (C) 2026 Alphazord (Alphazord.space)**  
**Last Updated:** September 24, 2026

---

## 1. BatchUp source code — AGPL-3.0

All source code in this repository (`apps/`, `packages/`, `scripts/`, and root configuration) is licensed under the **GNU Affero General Public License v3.0** (or, at your option, any later version published by the Free Software Foundation).

The full license text is in [`LICENSE`](./LICENSE).

### What AGPL-3.0 means in practice

- **You may** use, study, modify, and redistribute this software.
- **You may** run it as a hosted service (SaaS). If you modify it and let users interact with it over a network, you must make **your modified source** available to those users (AGPL §13).
- **You must** preserve copyright notices and license notices on all copies.
- **You must** license derivative works under AGPL-3.0 (copyleft).
- **There is no warranty**; the software is provided "as is".

### Why AGPL for a SaaS product

The AGPL closes the "SaaS loophole" in the GPL: running a modified BatchUp as a network service triggers source-disclosure obligations. Forks and hosted deployments must remain free software.

---

## 2. Documentation — AGPL-3.0

Documentation under `docs/`, `README.md`, `AGENTS.md`, and related markdown files is part of this project and is distributed under the same **AGPL-3.0** terms as the source, unless a file states otherwise.

---

## 3. Third-party dependencies

Runtime and development dependencies installed via pnpm are **not** covered by this license. Each dependency retains its own license, recorded in its package metadata and in `pnpm-lock.yaml`.

Before redistributing or offering a hosted deployment, review dependency licenses for AGPL compatibility (common permissive licenses — MIT, Apache-2.0, BSD, ISC — are generally compatible; some strong-copyleft or non-OSI licenses may not be).

---

## 4. Trademarks and branding

"BatchUp", "Alphazord", and Alphazord.space branding are not licensed under AGPL-3.0. The license grants no trademark rights. To avoid confusion when redistributing modified versions, do not imply endorsement by Alphazord.

---

## 5. Origin acknowledgment

This project was originally scaffolded from a commercial starter kit (SaaS LaunchKit Pro by AdnanBuilds.online). That commercial kit license applies to the original kit purchase separately from this repository. As of the relicense to AGPL-3.0, **this repository's code and docs are governed solely by the terms in `LICENSE` (AGPL-3.0)**, subject to any rights retained by prior licensors in unmodified third-party portions.

---

## 6. End-user terms

There is no separate proprietary end-user license agreement (EULA) for the BatchUp source. See [`EULA.md`](./EULA.md) for the relationship between this open-source license and any hosted service offered by Alphazord.
