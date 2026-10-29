/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * MOTOR RPG HD-2D DE PIXELVERSE — ISLA DEL ORIGEN:
 * Arquitectura de 3 Capas de Profundidad Visual:
 *   - CAPA 0 (zIndex: 0):  MAPA BASE (Suelo, caminos, mar, arena) -> map_base.png
 *   - CAPA 10 (zIndex: 10): JUGADOR Y ENTIDADES DINÁMICAS (Avatar pixel-art 4-dir, NPCs, interactivos)
 *   - CAPA 20 (zIndex: 20): OVERLAY SUPERIOR (Techos y árboles que tapan al jugador) -> map_overlay.png
 *   - CAPA 30+ (zIndex: 30): HUD, Diálogos GBC, Modales de Inventario [I], Misiones [Q], Códice [C] y Poderes [K]
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Compass, HelpCircle, Key, Layers, Map as MapIcon, Volume2, VolumeX, X } from 'lucide-react';
import mapBaseImage from '../assets/images/map_base.png';
import mapOverlayImage from '../assets/images/map_overlay.png';
import { retroAudio } from '../audio/retroAudio';
import { ArchitectCodexModal } from '../memories/ArchitectCodexModal';
import {
  loadProgressState,
  PixelverseProgressState,
  SPACE_INVADERS_UNLOCK_SCORE,
} from '../memories/progressionState';
import {
  loadKeybindings,
  isActionPressed,
  KeybindingsMap,
  isEditableTarget,
} from '../controls/keybindings';
import { PowersMenuModal } from '../rpg/PowersMenuModal';
import {
  FacingDirection,
  RPG_ITEMS,
  RPG_QUESTS,
} from '../rpg/rpgContent';
import { RpgInventoryModal, RpgQuestsModal } from '../rpg/rpgModals';
import type { AvatarAppearance } from '../avatar/avatarOptions';
import { DEFAULT_AVATAR_APPEARANCE } from '../avatar/avatarOptions';
import { drawPixelAvatar4Dir } from './island70sRenderer';
import { IslandZoneId } from './island70sData';

export type Island70sArrivalMode =
  | 'awakening'
  | 'standard'
  | 'pong-board'
  | 'glitch-trail-cleared'
  | 'invaders-ship'
  | 'return-breakout'
  | 'return-80s';

export interface Origin70sIslandProps {
  skinColor?: string;
  hairColor?: string;
  shirtColor?: string;
  appearance?: AvatarAppearance;
  allUnlocked?: boolean;
  arrivalMode?: Island70sArrivalMode;
  progressState?: PixelverseProgressState;
  onEnterPong?: () => void;
  onEnterBreakout?: () => void;
  onEnterBreakoutFromNorth?: () => void;
  onEnterGlitchTrail?: () => void;
  onEnterSpaceInvaders?: () => void;
  onEnterDonkeyKong?: () => void;
  onEnterAsteroids?: () => void;
  onEnterSeaWolf?: () => void;
  onEnterTank?: () => void;
  onEnterLunarLander?: () => void;
  onEnterNightDriver?: () => void;
  onEnterGalaxian?: () => void;
  onSetRpgFlag?: <K extends keyof import('../memories/progressionState').RpgExplorationState>(
    key: K,
    val: import('../memories/progressionState').RpgExplorationState[K]
  ) => void;
  onRestoreCuatroCaminos?: () => void;
  onCollectDiamond?: (diamondId: string) => void;
  onVisitZone?: (zoneId: IslandZoneId) => void;
  onDiscoverEcho?: (echoId: string) => void;
  onActivateSwitch?: (switchId: string) => void;
  onTalkNpc?: (npcId: string) => void;
  onSavePosition?: (x: number, y: number) => void;
  onSave80sPosition?: (x: number, y: number) => void;
  onManualSave?: (x: number, y: number) => void;
  onManualSave80s?: (x: number, y: number) => void;
  onOpenChest?: (chestId: string, rewardItemIds: string[]) => void;
  onDiscoverSecret?: (secretId: string) => void;
  onDiscoverClue?: (clueId: string) => void;
  onSolveCase?: (caseId: string, rewardItemIds?: string[]) => void;
  onCalmCreature?: (creatureId: string) => void;
  onInspectExhibit?: (exhibitId: string) => void;
  onSolvePuzzle?: (puzzleId: string, rewardItemIds?: string[]) => void;
  onRepairMechanism?: (mechanismId: string, alsoSwitches?: string[]) => void;
  onUpdateQuest?: (
    questId: string,
    status: 'active' | 'completed',
    rewardItemIds?: string[]
  ) => void;
  onEquipCosmetic?: (cosmeticId: string | null) => void;
  onToggleLantern?: (forceValue?: boolean) => void;
  onUpdatePowerEnergy?: (
    key: 'flightFuel' | 'lanternBattery' | 'scannerEnergy' | 'welderEnergy',
    amount: number
  ) => void;
  onPurchasePowerUpgrade?: (upgradeId: string, costDiamonds: number) => void;
  onRechargePowers?: () => void;
  onArrivalSequenceFinished?: () => void;
  isGbGreenMode?: boolean;
  onToggleGbGreenMode?: () => void;
  isAudioMuted?: boolean;
  onToggleAudio?: () => void;
  onOpenLevelSelector?: () => void;
  externalModalOpen?: boolean;
  manualSaveTriggerRef?: React.MutableRefObject<(() => string) | null>;
}

// Dimensiones de referencia de map_base.png y map_overlay.png
const MAP_NATAL_W = 2730;
const MAP_NATAL_H = 1536;
const MAP_ASPECT = MAP_NATAL_W / MAP_NATAL_H;

interface WalkBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Zonas caminables ajustadas a la escala 2730 × 1536 de map_base.png
const HD_WALK_BOXES: WalkBox[] = [
  // Playa del Aurora (Sur)
  { x: 1040, y: 1020, w: 720, h: 260 },
  // Muelle Suroeste
  { x: 910, y: 1080, w: 200, h: 200 },
  // Muelle Sureste
  { x: 1710, y: 980, w: 220, h: 200 },
  // Senda sur de ascenso desde la arena
  { x: 1180, y: 860, w: 340, h: 240 },
  // Pradera central y cruce de caminos empedrados
  { x: 1020, y: 540, w: 720, h: 380 },
  // Pradera de Casa (Cabaña Oeste)
  { x: 740, y: 660, w: 480, h: 340 },
  // Paso hacia el Alto de las Rocas (Noroeste)
  { x: 920, y: 460, w: 340, h: 260 },
  // Plataforma de piedra del Alto de las Rocas
  { x: 680, y: 230, w: 400, h: 350 },
  // Senda norte hacia el muelle
  { x: 1260, y: 300, w: 220, h: 320 },
  // Pasarela y tabla de surf del Puerto Norte
  { x: 1280, y: 210, w: 160, h: 160 },
  // Pradera y huertos noreste
  { x: 1380, y: 340, w: 600, h: 300 },
  // La Arboleda y Cabaña Este (Gabinete de Pong)
  { x: 1540, y: 500, w: 560, h: 440 },
  // Mirador del Oleaje y acantilados este
  { x: 1440, y: 840, w: 480, h: 280 },
];

const HD_SOLID_OBSTACLES: WalkBox[] = [
  // Cabaña familiar oeste
  { x: 860, y: 720, w: 250, h: 180 },
  // Cabaña de la arboleda este
  { x: 1770, y: 570, w: 220, h: 180 },
  // Grúa de izado en el Alto de las Rocas
  { x: 810, y: 240, w: 180, h: 70 },
];

function isHdPointWalkable(x: number, y: number): boolean {
  for (const s of HD_SOLID_OBSTACLES) {
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) {
      return false;
    }
  }
  for (const b of HD_WALK_BOXES) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      return true;
    }
  }
  return false;
}

interface InteractivePoi {
  id: string;
  x: number;
  y: number;
  radius: number;
  label: string;
  actionLabel: string;
  category: string;
  dialogTitle: string;
  dialogSubtitle: string;
  paragraphs: string[];
  isPongCabinet?: boolean;
  isDeparture?: boolean;
}

const HD_INTERACTIVES: InteractivePoi[] = [
  {
    id: 'casa-familiar',
    x: 1040,
    y: 890,
    radius: 90,
    label: 'Cabaña Familiar',
    actionLabel: 'Entrar a la Cabaña',
    category: 'HOGAR · MEMORIAS DE LA INFANCIA',
    dialogTitle: 'La Casa de la Pradera',
    dialogSubtitle: 'Interior · Cabaña familiar',
    paragraphs: [
      'La puerta de madera se abre con su crujido habitual. Adentro huele a leña de pino, a pan horneado y a la lámpara de aceite encendida junto a la ventana.',
      'En la mesa reposa una taza de infusión tibia y el cuaderno donde trazabas tus primeros mapas de videojuegos.',
      'Sientes la calma de volver al punto donde todo comenzó.',
    ],
  },
  {
    id: 'gabinete-pong',
    x: 1760,
    y: 720,
    radius: 95,
    label: 'Gabinete Clásico de Pong (1972)',
    actionLabel: 'Desafiar al Pong (1972)',
    category: 'SANTUARIO HISTÓRICO · ATARI 1972',
    dialogTitle: 'El Santuario de Pong',
    dialogSubtitle: 'Gabinete amarillo de 1972',
    paragraphs: [
      'La pantalla de tubo emite su zumbido característico de fósforo y dos paletas blancas vibran esperando el saque.',
      'Supera el reto de Pong para desbloquear la legendaria Barra Flotante y cruzar las aguas hacia la Isla del Origen.',
    ],
    isPongCabinet: true,
  },
  {
    id: 'puerto-norte',
    x: 1360,
    y: 280,
    radius: 90,
    label: 'Puerto Norte · Dársena de Partida',
    actionLabel: 'Zarpar en Tabla de Pong',
    category: 'TRAVESÍA MARÍTIMA A ISLA DEL ORIGEN',
    dialogTitle: 'El Muelle del Norte',
    dialogSubtitle: 'Travesía sobre el mar de datos',
    paragraphs: [
      'Las tablas del muelle se extienden sobre el agua cristalina hacia el norte.',
      'Con la paleta de Pong restaurada, puedes deslizarte sobre las olas y abrirte paso hacia los misterios de la Era de los 70.',
    ],
    isDeparture: true,
  },
  {
    id: 'alto-rocas',
    x: 880,
    y: 430,
    radius: 100,
    label: 'Mirador del Alto de las Rocas',
    actionLabel: 'Observar el Horizonte',
    category: 'VISTA PANORÁMICA',
    dialogTitle: 'El Mirador del Horizonte Cósmico',
    dialogSubtitle: 'Brisa marina y señales distantes',
    paragraphs: [
      'Desde este altozano de piedra milenaria se contempla la inmensidad del océano de PIXELVERSE.',
      'A lo lejos, destellos de fósforo y neón delatan la presencia de otras épocas esperando ser restauradas.',
    ],
  },
  {
    id: 'playa-aurora',
    x: 1365,
    y: 1180,
    radius: 100,
    label: 'Orilla de la Playa del Aurora',
    actionLabel: 'Escuchar el Mar',
    category: 'SERENIDAD MARINA',
    dialogTitle: 'Playa del Aurora',
    dialogSubtitle: 'Donde el mar te dejó despertar',
    paragraphs: [
      'Las olas acarician la arena dorada con un ritmo pausado y cristalino.',
      'Pequeños peces de colores y arrecifes de coral decoran las aguas poco profundas alrededor de la orilla.',
    ],
  },
  {
    id: 'fogata-campamento',
    x: 1290,
    y: 490,
    radius: 80,
    label: 'Fogata Central',
    actionLabel: 'Descansar junto al Fuego',
    category: 'REFUGIO',
    dialogTitle: 'El Fuego de la Vigilia',
    dialogSubtitle: 'Calor de brasas crepitantes',
    paragraphs: [
      'Las brasas de leña seca crujen suavemente arrojando chispas al aire templado de la tarde.',
      'Un momento perfecto para recuperar energías y organizar tus pensamientos.',
    ],
  },
];

export const Origin70sIsland: React.FC<Partial<Origin70sIslandProps>> = (props = {}) => {
  const {
    skinColor = '#ffccaa',
    hairColor = '#331100',
    shirtColor = '#00f3ff',
    appearance = DEFAULT_AVATAR_APPEARANCE,
    allUnlocked = false,
    arrivalMode = 'standard',
    progressState: propProgressState,
    onEnterPong,
    onEnterBreakout,
    onEnterGlitchTrail,
    onEnterSpaceInvaders,
    onEnterDonkeyKong,
    onCollectDiamond,
    onTalkNpc,
    onEquipCosmetic,
    onToggleLantern,
    onPurchasePowerUpgrade,
    isGbGreenMode = false,
    onToggleGbGreenMode,
    isAudioMuted = false,
    onToggleAudio,
    onOpenLevelSelector,
  } = props;

  const defaultProgressState = useMemo(() => loadProgressState(), []);
  const progressState = propProgressState ?? defaultProgressState;

  // Medidas de la ventana para calcular el ajuste contain
  const [viewportSize, setViewportSize] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 720,
  });

  // Posición del jugador en coordenadas nativas del mapa (2730 × 1536)
  const initialWorldPos = useMemo(() => {
    if (arrivalMode === 'awakening') return { x: 1365, y: 1200 };
    if (progressState.island70s?.lastIslandPos) {
      const c = progressState.island70s.lastIslandPos;
      if (c.x > 500 && c.x < 2300 && c.y > 200 && c.y < 1400) {
        return { x: c.x, y: c.y };
      }
    }
    return { x: 1365, y: 1180 };
  }, [arrivalMode, progressState.island70s?.lastIslandPos]);

  const worldPosRef = useRef({ x: initialWorldPos.x, y: initialWorldPos.y });
  const [playerFacing, setPlayerFacing] = useState<FacingDirection>('up');
  const [isWalking, setIsWalking] = useState(false);
  const [isSprinting, setIsSprinting] = useState(false);

  // Posición en píxeles de pantalla transformada según el contenedor con bg-contain
  const [playerScreenPos, setPlayerScreenPos] = useState({ x: 600, y: 400 });

  // Modales de juego
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [questsOpen, setQuestsOpen] = useState(false);
  const [codexOpen, setCodexOpen] = useState(false);
  const [powersMenuOpen, setPowersMenuOpen] = useState(false);
  const [activeDialog, setActiveDialog] = useState<InteractivePoi | null>(null);
  const [nearbyPoi, setNearbyPoi] = useState<InteractivePoi | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const keysPressed = useRef<Set<string>>(new Set());
  const avatarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animTimeRef = useRef(0);

  // Calcular rectángulo del mapa contenido en la pantalla (bg-contain bg-center)
  const mapDisplayMetrics = useMemo(() => {
    const { w, h } = viewportSize;
    const windowAspect = w / (h || 1);
    let dw: number;
    let dh: number;
    let ox: number;
    let oy: number;

    if (windowAspect > MAP_ASPECT) {
      dh = h;
      dw = h * MAP_ASPECT;
      ox = (w - dw) / 2;
      oy = 0;
    } else {
      dw = w;
      dh = w / MAP_ASPECT;
      ox = 0;
      oy = (h - dh) / 2;
    }

    const scale = dw / MAP_NATAL_W;
    return { dw, dh, ox, oy, scale };
  }, [viewportSize]);

  // Actualizar tamaño de ventana
  useEffect(() => {
    const handleResize = () => {
      setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sincronizar posición en pantalla del jugador
  const updateScreenPos = useCallback(() => {
    const { ox, oy, scale } = mapDisplayMetrics;
    const sx = Math.round(ox + worldPosRef.current.x * scale);
    const sy = Math.round(oy + worldPosRef.current.y * scale);
    setPlayerScreenPos({ x: sx, y: sy });
  }, [mapDisplayMetrics]);

  useEffect(() => {
    updateScreenPos();
  }, [updateScreenPos]);

  // Manejo de teclado
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const key = e.key.toLowerCase();
      keysPressed.current.add(key);

      // Teclas de acceso rápido a modales
      if (key === 'i') {
        e.preventDefault();
        setInventoryOpen((prev) => !prev);
        retroAudio.uiClick();
        return;
      }
      if (key === 'q') {
        e.preventDefault();
        setQuestsOpen((prev) => !prev);
        retroAudio.uiClick();
        return;
      }
      if (key === 'c') {
        e.preventDefault();
        setCodexOpen((prev) => !prev);
        retroAudio.uiClick();
        return;
      }
      if (key === 'k') {
        e.preventDefault();
        setPowersMenuOpen((prev) => !prev);
        retroAudio.uiClick();
        return;
      }
      if (key === 'e' || key === ' ') {
        if (activeDialog) {
          e.preventDefault();
          setActiveDialog(null);
          retroAudio.uiClick();
          return;
        }
        if (nearbyPoi) {
          e.preventDefault();
          if (nearbyPoi.isPongCabinet) {
            retroAudio.pongPaddle();
            onEnterPong?.();
          } else if (nearbyPoi.isDeparture) {
            retroAudio.portalVictory();
            onEnterPong?.();
          } else {
            retroAudio.npcBlip();
            setActiveDialog(nearbyPoi);
          }
        }
      }
      if (key === 'escape') {
        setInventoryOpen(false);
        setQuestsOpen(false);
        setCodexOpen(false);
        setPowersMenuOpen(false);
        setActiveDialog(null);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [activeDialog, nearbyPoi, onEnterPong]);

  // Bucle de movimiento y renderizado del avatar en Capa 10
  useEffect(() => {
    let lastTime = performance.now();
    let rafId: number;

    const gameLoop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      animTimeRef.current += dt;

      const modalIsActive =
        inventoryOpen || questsOpen || codexOpen || powersMenuOpen || activeDialog !== null;

      if (!modalIsActive) {
        const keys = keysPressed.current;
        let dx = 0;
        let dy = 0;

        if (keys.has('w') || keys.has('arrowup')) dy -= 1;
        if (keys.has('s') || keys.has('arrowdown')) dy += 1;
        if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
        if (keys.has('d') || keys.has('arrowright')) dx += 1;

        const sprinting = keys.has('shift');
        setIsSprinting(sprinting);

        if (dx !== 0 || dy !== 0) {
          const mag = Math.hypot(dx, dy);
          const speed = (sprinting ? 320 : 210) * dt;
          const vx = (dx / mag) * speed;
          const vy = (dy / mag) * speed;

          const curX = worldPosRef.current.x;
          const curY = worldPosRef.current.y;
          let newX = curX + vx;
          let newY = curY + vy;

          // Detección de colisión con deslizamiento en ejes
          if (isHdPointWalkable(newX, newY)) {
            worldPosRef.current.x = newX;
            worldPosRef.current.y = newY;
          } else if (isHdPointWalkable(newX, curY)) {
            worldPosRef.current.x = newX;
          } else if (isHdPointWalkable(curX, newY)) {
            worldPosRef.current.y = newY;
          }

          // Orientación de avatar
          let nextFacing: FacingDirection = 'down';
          if (Math.abs(dx) > Math.abs(dy)) {
            nextFacing = dx > 0 ? 'right' : 'left';
          } else {
            nextFacing = dy > 0 ? 'down' : 'up';
          }
          setPlayerFacing(nextFacing);
          setIsWalking(true);
          updateScreenPos();
        } else {
          setIsWalking(false);
        }

        // Detectar interactivo más cercano
        const px = worldPosRef.current.x;
        const py = worldPosRef.current.y;
        let foundPoi: InteractivePoi | null = null;
        let minDist = Number.POSITIVE_INFINITY;

        for (const poi of HD_INTERACTIVES) {
          const dist = Math.hypot(poi.x - px, poi.y - py);
          if (dist <= poi.radius && dist < minDist) {
            minDist = dist;
            foundPoi = poi;
          }
        }
        setNearbyPoi(foundPoi);
      }

      // Dibujar avatar animado en el canvas de la Capa 10
      const cvs = avatarCanvasRef.current;
      if (cvs) {
        const ctx = cvs.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, 48, 48);
          ctx.imageSmoothingEnabled = false;
          drawPixelAvatar4Dir(
            ctx,
            24,
            38,
            playerFacing,
            isWalking,
            isSprinting,
            animTimeRef.current,
            skinColor,
            hairColor,
            shirtColor,
            {
              equippedCosmetic: progressState.rpg?.equippedCosmetic ?? null,
              lanternActive: progressState.rpg?.lanternActive ?? false,
              appearance,
            }
          );
        }
      }

      rafId = requestAnimationFrame(gameLoop);
    };

    rafId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(rafId);
  }, [
    activeDialog,
    appearance,
    codexOpen,
    hairColor,
    inventoryOpen,
    isSprinting,
    isWalking,
    playerFacing,
    powersMenuOpen,
    progressState.rpg?.equippedCosmetic,
    progressState.rpg?.lanternActive,
    questsOpen,
    shirtColor,
    skinColor,
    updateScreenPos,
  ]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(null), 3200);
  }, []);

  const playerPos = playerScreenPos;

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-[#020614]">
      {/* CAPA 0: MAPA BASE (Suelo, arena, caminos, agua) */}
      <div
        className="absolute inset-0 bg-contain bg-center bg-no-repeat pointer-events-none"
        style={{
          backgroundImage: `url(${mapBaseImage})`,
          zIndex: 0,
        }}
      />

      {/* CAPA 10: JUGADOR Y ENTIDADES DINÁMICAS */}
      <div
        className="absolute transition-all duration-75 pointer-events-none"
        style={{
          transform: `translate(${playerPos.x}px, ${playerPos.y}px)`,
          zIndex: 10,
        }}
      >
        {/* Tu avatar o sprite actual */}
        <div className="relative -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          {/* Sombra elíptica sobre el terreno */}
          <div className="absolute bottom-1 w-7 h-2.5 bg-black/45 rounded-full blur-[0.5px]" />
          <canvas
            ref={avatarCanvasRef}
            width={48}
            height={48}
            className="block relative pointer-events-none"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
      </div>

      {/* Etiqueta flotante interactiva de acción [E] */}
      {nearbyPoi && !activeDialog && (
        <div
          className="absolute z-15 pointer-events-none -translate-x-1/2 -translate-y-full"
          style={{
            left: `${playerPos.x}px`,
            top: `${playerPos.y - 36}px`,
          }}
        >
          <div className="px-3 py-1.5 rounded-lg border border-[#00f3ff] bg-[#07111e]/90 shadow-[0_0_15px_rgba(0,243,255,0.4)] backdrop-blur-sm text-center">
            <span className="font-mono text-[11px] font-bold text-[#fde047] uppercase tracking-wider block">
              [E] {nearbyPoi.actionLabel}
            </span>
            <span className="font-mono text-[9px] text-[#7dd3fc] block mt-0.5">
              {nearbyPoi.label}
            </span>
          </div>
        </div>
      )}

      {/* CAPA 20: OVERLAY SUPERIOR (Árboles y techos con viento) */}
      <div
        className="absolute inset-0 bg-contain bg-center bg-no-repeat pointer-events-none animate-wind"
        style={{
          backgroundImage: `url(${mapOverlayImage})`,
          zIndex: 20,
        }}
      />

      {/* Animación CSS local para el viento en los árboles */}
      <style>{`
        @keyframes windSway {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-2px) rotate(0.3deg); }
        }
        .animate-wind {
          animation: windSway 5s ease-in-out infinite;
          transform-origin: bottom center;
        }
      `}</style>

      {/* Resto de tu HUD y modales (Mochila, Códice, Controles, etc.) con zIndex superior */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 30 }}>
        {/* Barra superior HUD */}
        <header className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="px-3 py-1.5 rounded-lg border border-cyan-400/40 bg-black/70 backdrop-blur-md text-xs font-mono font-bold text-cyan-300 shadow-md">
              ISLA DEL ORIGEN · EXPLORACIÓN HD-2D
            </div>
            {onOpenLevelSelector && (
              <button
                type="button"
                onClick={() => {
                  retroAudio.uiClick();
                  onOpenLevelSelector();
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900/80 hover:border-cyan-400 text-xs font-mono text-slate-300 transition-colors cursor-pointer"
              >
                Niveles
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              title="Inventario [I]"
              onClick={() => {
                retroAudio.uiClick();
                setInventoryOpen(true);
              }}
              className="px-2.5 py-1 rounded border border-white/20 bg-slate-900/80 hover:border-amber-300 text-xs font-mono font-bold text-amber-200 cursor-pointer"
            >
              [I] Mochila
            </button>
            <button
              type="button"
              title="Diario de Misiones [Q]"
              onClick={() => {
                retroAudio.uiClick();
                setQuestsOpen(true);
              }}
              className="px-2.5 py-1 rounded border border-white/20 bg-slate-900/80 hover:border-cyan-300 text-xs font-mono font-bold text-cyan-200 cursor-pointer"
            >
              [Q] Misiones
            </button>
            <button
              type="button"
              title="Poderes y Mejoras [K]"
              onClick={() => {
                retroAudio.uiClick();
                setPowersMenuOpen(true);
              }}
              className="px-2.5 py-1 rounded border border-white/20 bg-slate-900/80 hover:border-purple-300 text-xs font-mono font-bold text-purple-200 cursor-pointer"
            >
              [K] Poderes
            </button>
            {onToggleAudio && (
              <button
                type="button"
                onClick={onToggleAudio}
                className="p-1.5 rounded border border-white/20 bg-slate-900/80 text-slate-300 hover:text-white cursor-pointer"
                title={isAudioMuted ? 'Activar Audio' : 'Silenciar'}
              >
                {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        </header>

        {/* Controles de pie y consejos */}
        <footer className="absolute bottom-3 left-3 pointer-events-none">
          <div className="px-3 py-1.5 rounded border border-white/10 bg-black/60 backdrop-blur-sm text-[10px] font-mono text-slate-300">
            WASD / Flechas: Caminar · Shift: Correr · [E]: Interactuar · [I]: Mochila · [Q]: Misiones
          </div>
        </footer>

        {/* Notificación Toast flotante */}
        {toastMessage && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-none px-4 py-2 rounded-xl border border-amber-300/60 bg-black/85 text-amber-300 text-xs font-mono font-bold shadow-lg">
            {toastMessage}
          </div>
        )}
      </div>

      {/* Cuadro de Diálogo Narrativo */}
      {activeDialog && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm pointer-events-auto">
          <div className="w-full max-w-xl rounded-2xl border-2 border-[#00f3ff] bg-[#07111e] p-5 shadow-[0_0_30px_rgba(0,243,255,0.3)] space-y-3">
            <div className="flex items-start justify-between border-b border-cyan-400/30 pb-2">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400">
                  {activeDialog.category}
                </span>
                <h3 className="text-base font-mono font-bold text-white mt-0.5">
                  {activeDialog.dialogTitle}
                </h3>
                {activeDialog.dialogSubtitle && (
                  <p className="text-xs font-mono text-slate-400">{activeDialog.dialogSubtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveDialog(null)}
                className="text-slate-400 hover:text-white font-mono font-bold p-1 cursor-pointer"
              >
                [X]
              </button>
            </div>
            <div className="space-y-2 text-xs font-mono leading-relaxed text-slate-200">
              {activeDialog.paragraphs.map((par, i) => (
                <p key={i}>{par}</p>
              ))}
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  retroAudio.uiClick();
                  setActiveDialog(null);
                }}
                className="px-4 py-2 rounded-lg bg-cyan-400 text-black font-mono font-bold text-xs hover:bg-cyan-300 cursor-pointer"
              >
                Continuar [Enter / E]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Inventario [I] */}
      {inventoryOpen && (
        <RpgInventoryModal
          progressState={progressState}
          allUnlocked={allUnlocked}
          closing={false}
          onClose={() => setInventoryOpen(false)}
          onUseScanner={() => {
            showToast('Pulso Sonar sintonizado');
            retroAudio.flashBurst();
          }}
          onToggleLantern={() => {
            onToggleLantern?.();
            showToast('Linterna de Fósforo conmutada');
          }}
          onUseWelder={() => {
            showToast('Soldador de Germanio calibrado');
            retroAudio.tick();
          }}
          onEquipCosmetic={(id) => onEquipCosmetic?.(id)}
        />
      )}

      {/* Modal de Misiones [Q] */}
      {questsOpen && (
        <RpgQuestsModal
          progressState={progressState}
          allUnlocked={allUnlocked}
          onSolveCase={() => {}}
          onClose={() => setQuestsOpen(false)}
        />
      )}

      {/* Modal de Códice [C] */}
      {codexOpen && (
        <ArchitectCodexModal
          progressState={progressState}
          allUnlocked={allUnlocked}
          onClose={() => setCodexOpen(false)}
        />
      )}

      {/* Modal de Poderes [K] */}
      {powersMenuOpen && (
        <PowersMenuModal
          progressState={progressState}
          allUnlocked={allUnlocked}
          onClose={() => setPowersMenuOpen(false)}
          onInvokeFlight={() => {
            setPowersMenuOpen(false);
            showToast('¡Tabla de Pong activada!');
            retroAudio.portalVictory();
          }}
          onToggleLantern={() => {
            onToggleLantern?.();
            showToast('Linterna de Fósforo conmutada');
          }}
          onUseScanner={() => {
            showToast('Escáner de Frecuencias activado');
            retroAudio.flashBurst();
          }}
          onUseWelder={() => {
            showToast('Soldador de Arco activado');
            retroAudio.tick();
          }}
          onUpgradePower={(id, cost) => {
            onPurchasePowerUpgrade?.(id, cost);
            showToast('¡Mejora de poder adquirida!');
          }}
        />
      )}
    </div>
  );
};
