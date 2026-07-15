const { test, expect } = require('@playwright/test');

async function checkpoint(page, testInfo, name) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

async function visibleUxAudit(page, testInfo, checkpointName) {
  const result = await page.evaluate(() => {
    const interactiveSelector = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"]';
    const auditRoot = document.querySelector('[role="dialog"][aria-modal="true"]') || document.body;
    const isVisible = element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };

    const touchTargets = [...auditRoot.querySelectorAll(interactiveSelector)]
      .filter(isVisible)
      .map(element => {
        const rect = element.getBoundingClientRect();
        return {
          label: (element.getAttribute('aria-label') || element.textContent || element.getAttribute('placeholder') || element.tagName).trim().slice(0, 80),
          tag: element.tagName.toLowerCase(),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      })
      .filter(target => target.width < 44 || target.height < 44);

    const overflow = [...auditRoot.querySelectorAll('*')]
      .filter(isVisible)
      .map(element => {
        const rect = element.getBoundingClientRect();
        return {
          label: (element.getAttribute('aria-label') || element.textContent || element.tagName).trim().replace(/\s+/g, ' ').slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right)
        };
      })
      // Ignore intentionally off-screen accessibility helpers; report only elements
      // that intersect the viewport and are visibly clipped at an edge.
      .filter(item => item.right > 0 && item.left < window.innerWidth && (item.left < -1 || item.right > window.innerWidth + 1))
      .slice(0, 20);

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      horizontalScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
      touchTargets,
      overflow,
      cls: window.__tablettoCLS || 0
    };
  });

  await testInfo.attach(`ux-audit-${checkpointName}`, {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json'
  });

  console.log(`UX_AUDIT ${checkpointName} ${JSON.stringify({
    viewport: result.viewport,
    horizontalScroll: result.horizontalScroll,
    touchTargetCount: result.touchTargets.length,
    touchTargetSample: result.touchTargets.slice(0, 8),
    overflow: result.overflow,
    cls: result.cls
  })}`);

  expect.soft(result.horizontalScroll, `${checkpointName}: horizontaler Seiten-Scroll`).toBe(false);
  expect.soft(result.overflow, `${checkpointName}: Elemente ragen aus dem Viewport`).toEqual([]);
  expect.soft(result.touchTargets.length, `${checkpointName}: sichtbare Touch-Targets unter 44×44 px`).toBe(0);
  expect.soft(result.cls, `${checkpointName}: CLS überschreitet 0,1`).toBeLessThanOrEqual(0.1);
}

async function openHeaderMenu(page) {
  const menuButton = page.getByRole('button', { name: 'Hauptmenü öffnen' });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__tablettoCLS = 0;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__tablettoCLS += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
});

test('kritische Tabletto-Prozessketten und visueller UX-Audit', async ({ page }, testInfo) => {
  const unique = `${testInfo.project.name}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `qa-${unique}@example.test`;
  const password = 'SicheresPasswort123!';
  const medicationName = `Metformin QA ${unique.slice(-6)}`;
  const editedName = `${medicationName} Retard`;

  await test.step('Flow 1: Registrierung, sichtbares Feedback und Login', async () => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Registrieren' })).toBeVisible();
    await page.getByLabel('E-Mail').fill(email);
    await page.getByLabel('Passwort').fill(password);
    await page.getByRole('button', { name: 'Account erstellen' }).click();
    await expect(page.getByText('Registrierung erfolgreich. Bitte anmelden.')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('E-Mail').fill(email);
    await page.getByLabel('Passwort').fill(password);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Dein Medikamenten-Cockpit' })).toBeVisible();
    await expect(page.getByText('Noch keine Medikamente vorhanden.')).toBeVisible();
    await checkpoint(page, testInfo, '01-empty-dashboard');
    await visibleUxAudit(page, testInfo, 'empty-dashboard');
  });

  await test.step('Flow 2: Medikament anlegen, Feedback sehen, suchen und filtern', async () => {
    await page.getByRole('button', { name: 'Medikament hinzufügen', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Medikament hinzufügen' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Name').fill(medicationName);
    await dialog.getByRole('button', { name: '1 Tabletten' }).click();
    await dialog.getByLabel('Aktueller Bestand').fill('30');
    await checkpoint(page, testInfo, '02-create-medication-dialog');
    await visibleUxAudit(page, testInfo, 'create-medication-dialog');
    await dialog.getByRole('button', { name: 'Speichern', exact: true }).click();

    await expect(page.getByText(`${medicationName} gespeichert.`)).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { name: medicationName })).toBeVisible();
    await page.getByPlaceholder('Suche nach Name...').fill('nicht-vorhanden');
    await expect(page.getByText('Keine Medikamente entsprechen deiner Suche.')).toBeVisible();
    await page.getByPlaceholder('Suche nach Name...').fill(medicationName);
    await expect(page.getByRole('heading', { name: medicationName })).toBeVisible();
    await checkpoint(page, testInfo, '03-created-and-filtered');
  });

  await test.step('Flow 3: Detail öffnen, Bestand pflegen, Historie und Bearbeitung prüfen', async () => {
    await page.getByRole('heading', { name: medicationName }).click();
    await expect(page).toHaveURL(/\/medication\/\d+$/);
    await expect(page.getByRole('heading', { name: medicationName })).toBeVisible();

    await page.getByRole('button', { name: 'Bestand setzen' }).click();
    const setStockDialog = page.getByRole('dialog', { name: 'Bestand setzen' });
    await setStockDialog.getByLabel('Neuer Bestand').fill('10');
    await setStockDialog.getByRole('button', { name: 'Bestätigen' }).click();
    await expect(page.getByRole('status')).toHaveText('Bestand wurde aktualisiert.');
    await expect(page.getByText('Aktueller Bestand:').locator('..')).toContainText('10');
    await expect(page.getByText('Bestand gesetzt')).toBeVisible();

    await page.getByRole('button', { name: 'Packung hinzufügen' }).click();
    const addPackageDialog = page.getByRole('dialog', { name: 'Packung hinzufügen' });
    await addPackageDialog.getByLabel('Packungsgröße (Tabletten)').fill('20');
    await addPackageDialog.getByRole('button', { name: 'Bestätigen' }).click();
    await expect(page.getByRole('status')).toHaveText('Packung wurde hinzugefügt.');
    await expect(page.getByText('Aktueller Bestand:').locator('..')).toContainText('30');
    await expect(page.getByText('Packung hinzugefügt')).toBeVisible();

    await page.getByRole('button', { name: 'Medikament bearbeiten' }).click();
    const editDialog = page.getByRole('dialog', { name: 'Medikament bearbeiten' });
    await editDialog.getByLabel('Name').fill(editedName);
    await editDialog.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(editDialog).toBeHidden();
    await expect(page.getByRole('status')).toHaveText('Medikament wurde aktualisiert.');
    await expect(page.getByRole('heading', { name: editedName })).toBeVisible();
    await checkpoint(page, testInfo, '04-updated-medication-detail');
    await visibleUxAudit(page, testInfo, 'medication-detail');
  });

  await test.step('Flow 4: Einstellungen speichern, Navigation und Persistenz prüfen', async () => {
    await openHeaderMenu(page);
    await page.getByRole('menuitem', { name: 'Einstellungen' }).click();
    await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible();
    await page.getByRole('button', { name: 'Liste', exact: true }).click();
    await page.getByRole('button', { name: 'Listenansicht' }).click();
    await page.getByRole('button', { name: /Einstellungen speichern/ }).click();
    await expect(page.getByText('Einstellungen gespeichert ✓')).toBeVisible();

    await openHeaderMenu(page);
    await page.getByRole('menuitem', { name: 'Dashboard' }).click();
    await expect(page.getByRole('heading', { name: editedName })).toBeVisible();
    await openHeaderMenu(page);
    await page.getByRole('menuitem', { name: 'Einstellungen' }).click();
    await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible();

    await expect.soft(
      page.getByRole('button', { name: 'Liste', exact: true }),
      'Die gewählte Dashboard-Ansicht muss nach Navigation persistieren'
    ).toHaveAttribute('aria-pressed', 'true');
    await expect.soft(
      page.getByRole('button', { name: 'Listenansicht' }),
      'Die gewählte Kalender-Ansicht muss nach Navigation persistieren'
    ).toHaveAttribute('aria-pressed', 'true');

    await openHeaderMenu(page);
    await page.getByRole('menuitem', { name: 'Kalender' }).click();
    await expect(page.getByRole('heading', { name: 'Medikamenten-Kalender' })).toBeVisible();
    await checkpoint(page, testInfo, '05-calendar');
    await visibleUxAudit(page, testInfo, 'calendar');
  });

  await test.step('Flow 5: Medikament löschen, abmelden und Zugriffsschutz prüfen', async () => {
    await openHeaderMenu(page);
    await page.getByRole('menuitem', { name: 'Dashboard' }).click();
    await page.getByRole('heading', { name: editedName }).click();
    await page.getByRole('button', { name: 'Medikament löschen' }).click();
    const deleteDialog = page.getByRole('dialog', { name: 'Medikament löschen' });
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole('button', { name: 'Endgültig löschen' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Noch keine Medikamente vorhanden.')).toBeVisible();

    await openHeaderMenu(page);
    await page.getByRole('menuitem', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(async () => (await caches.keys()).filter(key => key.includes('api')))).toEqual([]);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });
});
