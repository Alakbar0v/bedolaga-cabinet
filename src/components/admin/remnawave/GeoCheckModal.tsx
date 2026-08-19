import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { NodeInfo } from '@/api/adminRemnawave';
import { GeoCheckIcon, PlayIcon, WarningIcon, XCloseIcon } from '@/components/icons';
import { Spinner } from '@/components/ui/Spinner';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { cn } from '@/lib/utils';
import { GeoCheckReport } from './GeoCheckReport';
import { buildGeoCheckRequest, isRouteReady, type GeoCheckRouteMode } from './geoCheckRoute';
import { GeoCheckSetup } from './GeoCheckSetup';
import { useGeoCheckJob } from './useGeoCheckJob';

interface GeoCheckModalProps {
  node: NodeInfo;
  onClose: () => void;
}

/**
 * GeoCheck ноды: выбор маршрута → ожидание → отчёт.
 *
 * Полноэкранный просмотр — режим самой модалки, а не отдельный оверлей:
 * оверлей поверх портала выпал бы из ловушки фокуса, и его кнопка закрытия
 * стала бы недоступна с клавиатуры.
 */
export function GeoCheckModal({ node, onClose }: GeoCheckModalProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<GeoCheckRouteMode>('default');
  const [value, setValue] = useState('');
  const [fullscreen, setFullscreen] = useState(false);

  const job = useGeoCheckJob(node.uuid);
  const isRunning = job.phase === 'running';

  // Пока идёт проверка, закрывать по Escape нельзя: задача уже поставлена
  // в панель, и молча потерять её результат — хуже, чем подождать.
  const dialogRef = useFocusTrap<HTMLDivElement>(true, {
    onEscape: isRunning ? undefined : fullscreen ? () => setFullscreen(false) : onClose,
  });

  useEffect(() => {
    if (job.phase !== 'done') setFullscreen(false);
  }, [job.phase]);

  const canStart = isRouteReady(mode, value);

  const handleStart = () => {
    if (!canStart) return;
    job.start(buildGeoCheckRequest(mode, value));
  };

  const handleBackdropClick = () => {
    if (!isRunning) onClose();
  };

  const errorText =
    job.error?.kind === 'timeout'
      ? t(
          'admin.remnawave.geoCheck.error.timeout',
          'The node did not answer in time. Try running the check again.',
        )
      : (job.error?.message ??
        t('admin.remnawave.geoCheck.error.generic', 'The check could not be completed.'));

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        paddingTop: fullscreen ? 0 : 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: fullscreen ? 0 : 'max(1rem, env(safe-area-inset-bottom))',
        paddingLeft: fullscreen ? 0 : 'max(1rem, env(safe-area-inset-left))',
        paddingRight: fullscreen ? 0 : 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <div
        className="absolute inset-0 bg-dark-950/80 backdrop-blur-sm"
        onClick={handleBackdropClick}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="geocheck-modal-title"
        tabIndex={-1}
        className={cn(
          'relative flex w-full flex-col border border-dark-700 bg-dark-900 shadow-2xl',
          fullscreen
            ? 'h-full max-h-none max-w-none rounded-none p-3'
            : 'max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-5',
          // Отчёт заметно шире формы запуска — под него модалка расширяется.
          !fullscreen && (job.phase === 'done' ? 'max-w-4xl' : 'max-w-2xl'),
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-500/15 text-accent-400">
              <GeoCheckIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 id="geocheck-modal-title" className="text-lg font-semibold text-dark-100">
                {t('admin.remnawave.geoCheck.title', 'GeoCheck')}
              </h3>
              <p className="truncate text-xs text-dark-400">{node.name}</p>
            </div>
          </div>
          {!isRunning && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close', 'Close')}
              className="-mr-1.5 flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-dark-400 transition-colors hover:bg-dark-800 hover:text-dark-200"
            >
              <XCloseIcon />
            </button>
          )}
        </div>

        {job.phase === 'idle' && (
          <>
            <GeoCheckSetup
              node={node}
              mode={mode}
              value={value}
              onModeChange={(next) => {
                setMode(next);
                setValue('');
              }}
              onValueChange={setValue}
            />
            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-ghost">
                {t('common.close', 'Close')}
              </button>
              <button
                type="button"
                onClick={handleStart}
                disabled={!canStart}
                className="btn-primary"
              >
                <PlayIcon className="h-4 w-4" />
                {t('admin.remnawave.geoCheck.start', 'Run check')}
              </button>
            </div>
          </>
        )}

        {isRunning && (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <Spinner className="h-10 w-10" />
            <p className="text-sm font-medium text-dark-100">
              {t('admin.remnawave.geoCheck.running', 'Running the geo check')}
            </p>
            <p className="max-w-sm text-xs text-dark-400">
              {t(
                'admin.remnawave.geoCheck.runningHint',
                'The node is testing its connection — this usually takes up to a minute.',
              )}
            </p>
          </div>
        )}

        {job.phase === 'error' && (
          <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-error-500/15 text-error-400">
              <WarningIcon className="h-6 w-6" />
            </span>
            <p className="text-sm font-medium text-dark-100">
              {t('admin.remnawave.geoCheck.error.title', 'Check failed')}
            </p>
            <p className="max-w-sm break-words text-xs text-dark-400">{errorText}</p>
            <div className="mt-1 flex items-center gap-2">
              <button type="button" onClick={job.reset} className="btn-secondary">
                {t('admin.remnawave.geoCheck.changeRoute', 'Change route')}
              </button>
              <button type="button" onClick={job.retry} className="btn-primary">
                {t('admin.remnawave.geoCheck.rerun', 'Run again')}
              </button>
            </div>
          </div>
        )}

        {job.phase === 'done' && job.result && (
          <GeoCheckReport
            result={job.result}
            nodeName={node.name}
            fullscreen={fullscreen}
            onToggleFullscreen={() => setFullscreen((v) => !v)}
            onRerun={job.retry}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
