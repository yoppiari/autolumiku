/**
 * WhatsApp AI Conversations Monitoring
 * Monitor customer chats dan staff commands
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface Conversation {
  id: string;
  allConversationIds?: string[]; // All conversation IDs for this phone (grouped)
  customerPhone: string;
  customerName?: string;
  isStaff: boolean;
  conversationType: string;
  lastIntent?: string;
  status: string;
  lastMessageAt: string;
  escalatedTo?: string;
  isEscalated?: boolean; // True if any conversation for this phone is escalated
  messageCount: number;
  unreadCount: number;
  hasRealPhone?: boolean;
}

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  sender: string;
  senderType: string;
  content: string;
  intent?: string;
  aiResponse: boolean;
  createdAt: string;
}

interface TenantInfo {
  name: string;
  address?: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  email?: string;
}

interface TeamMember {
  id: string;
  firstName: string;
  lastName?: string;
  role: string;
  phone?: string;
  email?: string;
}

const EMOJI_CATEGORIES = [
  { id: 'smileys', name: 'Smileys & People', icon: '😀', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'] },
  { id: 'gestures', name: 'Gestures & Body', icon: '👍', emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👣', '👂', '🦻', '👃', '🫀', '🫁', '🧠', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋', '🩸'] },
  { id: 'animals', name: 'Animals & Nature', icon: '🐻', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔'] },
  { id: 'food', name: 'Food & Drink', icon: '🍔', emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕', '🫖', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊', '🥄', '🍴', '🍽️', '🥣', '🥡', '🥢', '🧂'] },
  { id: 'activity', name: 'Activities', icon: '⚽', emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫', '🎟️', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩'] },
  { id: 'travel', name: 'Travel & Places', icon: '🚗', emojis: ['🚗', '🚙', '🚕', '🛺', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🦼', '🦽', '🦺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '🚧', '⛽', '🚏', '🚦', '🚥', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏬', '💒', '🏛️', '⛪', '🕌', '🕍', '🛕', '🕋', '⛩️', '🛤️', '🛣️'] },
  { id: 'objects', name: 'Objects', icon: '💡', emojis: ['⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪓', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🪠', '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧼', '🪥', '🪒', '🧽', '🪣', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🪆', '🖼️', '🪞', '💎', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀', '🪄', '🪅', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌', '📥', '📤', '📦', '🏷️', '🪧', '📪', '📫', '📬', '📭', '📮', '📯', '📜', '📃', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒️', '🗓️', '📆', '📅', '🗑️', '📇', '🗃️', '🗳️', '🗄️', '📋', '📁', '📂', '🗂️', '🗞️', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇️', '📐', '📏', '🧮', '📌', '📍', '✂️', '🖊️', '🖋️', '✒️', '🖌️', '🖍️', '📝', '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓'] },
  { id: 'symbols', name: 'Symbols', icon: '🔣', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🛗', '🈁', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '⏏️', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '♾️', '💲', '💱', '™️', '©️', '®️', '👁️‍🗨️', '🔚', '🔙', '🔛', '🔝', '🔜', '〰️', '➰', '➿', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧'] },
  { id: 'flags', name: 'Flags', icon: '🚩', emojis: ['🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇫', '🇦🇽', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶', '🇦🇬', '🇦🇷', '🇦🇲', '🇦🇼', '🇦🇺', '🇦🇹', '🇦🇿', '🇧🇸', '🇧🇭', '🇧🇩', '🇧🇧', '🇧🇾', '🇧🇪', '🇧🇿', '🇧🇯', '🇧🇲', '🇧🇹', '🇧🇴', '🇧🇦', '🇧🇼', '🇧🇷', '🇮🇴', '🇻🇬', '🇧🇳', '🇧🇬', '🇧🇫', '🇧🇮', '🇰🇭', '🇨🇲', '🇨🇦', '🇮🇨', '🇨🇻', '🇧🇶', '🇰🇾', '🇨🇫', '🇹🇩', '🇨🇱', '🇨🇳', '🇨🇽', '🇨🇨', '🇨🇴', '🇰🇲', '🇨🇬', '🇨🇩', '🇨🇰', '🇨🇷', '🇨🇮', '🇭🇷', '🇨🇺', '🇨🇼', '🇨🇾', '🇨🇿', '🇩🇰', '🇩🇯', '🇩🇲', '🇩🇴', '🇪🇨', '🇪🇬', '🇸🇻', '🇬🇶', '🇪🇷', '🇪🇪', '🇪🇹', '🇪🇺', '🇫🇰', '🇫🇴', '🇫🇯', '🇫🇮', '🇫🇷', '🇬🇫', '🇵🇫', '🇹🇫', '🇬🇦', '🇬🇲', '🇬🇪', '🇩🇪', '🇬🇭', '🇬🇮', '🇬🇷', '🇬🇱', '🇬🇩', '🇬🇵', '🇬🇺', '🇬🇹', '🇬🇬', '🇬🇳', '🇬🇼', '🇬🇾', '🇭🇹', '🇭🇳', '🇭🇰', '🇭🇺', '🇮🇸', '🇮🇳', '🇮🇩', '🇮🇷', '🇮🇶', '🇮🇪', '🇮🇲', '🇮🇱', '🇮🇹', '🇯🇲', '🇯🇵', '🇯🇪', '🇯🇴', '🇰🇿', '🇰🇪', '🇰🇮', '🇽🇰', '🇰🇼', '🇰🇬', '🇱🇦', '🇱🇻', '🇱🇧', '🇱🇸', '🇱🇷', '🇱🇾', '🇱🇮', '🇱🇹', '🇱🇺', '🇲🇴', '🇲🇰', '🇲🇬', '🇲🇼', '🇲🇾', '🇲🇻', '🇲🇱', '🇲🇹', '🇲🇭', '🇲🇶', '🇲🇷', '🇲🇺', '🇾🇹', '🇲🇽', '🇫🇲', '🇲🇩', '🇲🇨', '🇲🇳', '🇲🇪', '🇲🇸', '🇲🇦', '🇲🇿', '🇲🇲', '🇳🇦', '🇳🇷', '🇳🇵', '🇳🇱', '🇳🇨', '🇳🇿', '🇳🇮', '🇳🇪', '🇳🇬', '🇳🇺', '🇳🇫', '🇰🇵', '🇲🇵', '🇳🇴', '🇴🇲', '🇵🇰', '🇵🇼', '🇵🇸', '🇵🇦', '🇵🇬', '🇵🇾', '🇵🇪', '🇵🇭', '🇵🇳', '🇵🇱', '🇵🇹', '🇵🇷', '🇶🇦', '🇷🇪', '🇷🇴', '🇷🇺', '🇷🇼', '🇼🇸', '🇸🇲', '🇸🇹', '🇸🇦', '🇸🇳', '🇷🇸', '🇸🇨', '🇸🇱', '🇸🇬', '🇸🇽', '🇸🇰', '🇸🇮', '🇸🇧', '🇸🇴', '🇿🇦', '🇬🇸', '🇰🇷', '🇸🇸', '🇪🇸', '🇱🇰', '🇧🇱', '🇸🇭', '🇰🇳', '🇱🇨', '🇵🇲', '🇻🇨', '🇸🇩', '🇸🇷', '🇸🇿', '🇸🇪', '🇨🇭', '🇸🇾', '🇹🇼', '🇹🇯', '🇹🇿', '🇹🇭', '🇹🇱', '🇹🇬', '🇹🇰', '🇹🇴', '🇹🇹', '🇹🇳', '🇹🇷', '🇹🇲', '🇹🇨', '🇹🇻', '🇺🇬', '🇺🇦', '🇦🇪', '🇬🇧', '🇺🇸', '🇺🇾', '🇺🇿', '🇻🇺', '🇻🇦', '🇻🇪', '🇻🇳', '🇼🇫', '🇪🇭', '🇾🇪', '🇿🇲', '🇿🇼'] }
];

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'customer' | 'staff' | 'escalated'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showImageUrlModal, setShowImageUrlModal] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageCaptionInput, setImageCaptionInput] = useState('');
  const [imageUploadMode, setImageUploadMode] = useState<'file' | 'url'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState('smileys');
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [documentUploadMode, setDocumentUploadMode] = useState<'file' | 'url'>('file');
  const [selectedDocument, setSelectedDocument] = useState<File | null>(null);
  const [documentUrlInput, setDocumentUrlInput] = useState('');
  const [documentCaptionInput, setDocumentCaptionInput] = useState('');
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  // State untuk mobile view - show chat or list
  const [showChatOnMobile, setShowChatOnMobile] = useState(false);

  // State untuk message menu (delete option)
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);
  const [isDeletingMessage, setIsDeletingMessage] = useState(false);
  const messageMenuRef = useRef<HTMLDivElement>(null);

  // State untuk delete conversation
  const [isDeletingConversation, setIsDeletingConversation] = useState<string | null>(null);

  // State untuk profile pictures
  const [profilePictures, setProfilePictures] = useState<Record<string, string | null>>({});

  // New states for header menu functionality
  const [isChatSearchActive, setIsChatSearchActive] = useState(false);
  const [chatSearchTerm, setChatSearchTerm] = useState('');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isFavorited, setIsFavorited] = useState<Record<string, boolean>>({});

  // State for AI config (to get AI name)
  const [aiConfig, setAiConfig] = useState<{ aiName: string } | null>(null);

  // State for real-time WhatsApp registration status
  const [whatsAppStatus, setWhatsAppStatus] = useState<Record<string, boolean>>({});

  // Load AI config to get AI name
  useEffect(() => {
    const loadAiConfig = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) return;

        const parsedUser = JSON.parse(storedUser);
        const tenantId = parsedUser.tenantId;

        const response = await fetch(`/api/v1/whatsapp-ai/config?tenantId=${tenantId}`);
        const data = await response.json();

        if (data.success && data.data) {
          setAiConfig({ aiName: data.data.aiName || 'AI Assistant' });
        }
      } catch (error) {
        console.error('Error loading AI config:', error);
      }
    };

    loadAiConfig();
  }, []);

  // Load conversations

  useEffect(() => {
    const loadConversations = async () => {
      setIsLoading(true);

      try {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
          console.error('No user found');
          return;
        }

        const parsedUser = JSON.parse(storedUser);
        const tenantId = parsedUser.tenantId;

        // Use a flag to prevent multiple rapid fetches if needed
        const response = await fetch(`/api/v1/whatsapp-ai/conversations?tenantId=${tenantId}`);
        const data = await response.json();

        if (data.success) {
          setConversations(data.data);
        }
      } catch (error) {
        console.error('Error loading conversations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConversations();
    // Refresh periodically
    const interval = setInterval(loadConversations, 60000);
    return () => clearInterval(interval);
  }, []);

  // Periodic refresh for profile pictures to retry failures
  useEffect(() => {
    const interval = setInterval(() => {
      // Clear the ref to allow re-fetching (retrying)
      loadedPhonesRef.current.clear();
      // This will trigger the profile picture loader effect
      setConversations(prev => [...prev]);
    }, 60000); // Retry every 60 seconds
    return () => clearInterval(interval);
  }, []);

  // Track which phones have been requested (to avoid duplicate API calls)
  const loadedPhonesRef = useRef<Set<string>>(new Set());

  // Load profile pictures for conversations
  useEffect(() => {
    const loadProfilePictures = async () => {
      if (conversations.length === 0) return;

      // Get phones that haven't been requested yet
      const phonesToLoad = conversations
        .map(conv => conv.customerPhone)
        .filter(phone => !loadedPhonesRef.current.has(phone));

      if (phonesToLoad.length === 0) return;

      console.log('[Profile Pictures] Loading for:', phonesToLoad);

      // Mark phones as being loaded
      phonesToLoad.forEach(phone => loadedPhonesRef.current.add(phone));

      // Load profile pictures in parallel (max 5 at a time)
      const batchSize = 5;
      for (let i = 0; i < phonesToLoad.length; i += batchSize) {
        const batch = phonesToLoad.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (phone) => {
            try {
              // Clean phone number before sending
              const cleanPhone = phone.replace(/@.*$/, '').replace(/:/g, '').replace(/[^0-9]/g, '');
              if (!cleanPhone) return;

              // Get tenantId from local storage
              const storedUser = localStorage.getItem('user');
              const tenantId = storedUser ? JSON.parse(storedUser).tenantId : null;

              const response = await fetch(
                `/api/v1/whatsapp-ai/profile-picture?phone=${cleanPhone}${tenantId ? `&tenantId=${tenantId}` : ''}`
              );
              const data = await response.json();

              console.log(`[Profile Pictures] ${cleanPhone} (Tenant: ${tenantId}):`, data.hasPicture ? 'HAS PICTURE' : 'no picture');

              if (data.success && data.hasPicture && data.pictureUrl) {
                setProfilePictures(prev => {
                  const updated = { ...prev, [phone]: data.pictureUrl };
                  console.log('[Profile Pictures] Updated state:', Object.keys(updated).length, 'entries');
                  return updated;
                });
              } else {
                setProfilePictures(prev => ({ ...prev, [phone]: null }));
              }
            } catch (error) {
              console.error('[Profile Pictures] Error:', phone, error);
              setProfilePictures(prev => ({ ...prev, [phone]: null }));
            }
          })
        );
      }
    };

    loadProfilePictures();
  }, [conversations]);

  // Load WhatsApp registration status for all conversations (real-time check)
  useEffect(() => {
    const loadWhatsAppStatuses = async () => {
      if (conversations.length === 0) return;

      console.log('[WhatsApp Status] Checking registration status for all conversations...');

      // Load statuses in parallel (max 5 at a time to avoid overwhelming the API)
      const batchSize = 5;
      const phones = conversations.map(conv => conv.customerPhone);

      for (let i = 0; i < phones.length; i += batchSize) {
        const batch = phones.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (phone) => {
            try {
              // Clean phone number
              const cleanPhone = phone.replace(/@.*$/, '').replace(/:/g, '').replace(/[^0-9]/g, '');
              if (!cleanPhone) return;

              const response = await fetch(`/api/v1/whatsapp-ai/check-whatsapp?phone=${cleanPhone}`);
              const data = await response.json();

              if (data.success) {
                // Key by CLEAN phone number
                setWhatsAppStatus(prev => ({
                  ...prev,
                  [cleanPhone]: data.isRegistered || false
                }));
                console.log(`[WhatsApp Status] ${cleanPhone}: ${data.isRegistered ? 'REGISTERED ✅' : 'NOT REGISTERED ❌'}`);
              } else {
                setWhatsAppStatus(prev => ({ ...prev, [cleanPhone]: false }));
              }
            } catch (error) {
              console.error(`[WhatsApp Status] Error checking ${phone}:`, error);
              const cleanPhone = phone.replace(/@.*$/, '').replace(/:/g, '').replace(/[^0-9]/g, '');
              setWhatsAppStatus(prev => ({ ...prev, [cleanPhone]: false }));
            }
          })
        );
      }

      console.log('[WhatsApp Status] ✅ Status check completed');
    };

    loadWhatsAppStatuses();

    // Refresh status every 2 minutes (WhatsApp status can change)
    const interval = setInterval(loadWhatsAppStatuses, 120000);
    return () => clearInterval(interval);
  }, [conversations]);

  // Load tenant info and team members for contact info

  useEffect(() => {
    const loadTenantAndTeam = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) return;

        const parsedUser = JSON.parse(storedUser);
        const tenantId = parsedUser.tenantId;

        // Get auth token for authenticated API calls
        const authToken = localStorage.getItem('authToken');

        // Fetch tenant info and team members in parallel
        const [tenantResponse, teamResponse] = await Promise.all([
          fetch(`/api/v1/tenants/${tenantId}`),
          fetch(`/api/v1/users?tenantId=${tenantId}`, {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
          }),
        ]);

        if (tenantResponse.ok) {
          const tenantData = await tenantResponse.json();
          const tenant = tenantData.data || tenantData.tenant;
          if (tenant) {
            setTenantInfo({
              name: tenant.name || '',
              address: tenant.address || '',
              phoneNumber: tenant.phoneNumber || '',
              whatsappNumber: tenant.whatsappNumber || '',
              email: tenant.email || '',
            });
          }
        }

        if (teamResponse.ok) {
          const teamData = await teamResponse.json();
          // API returns { success: true, data: { users: [...], stats: {...} } }
          const usersList = teamData.data?.users || teamData.data || [];
          if (teamData.success && usersList.length > 0) {
            // Filter to get staff with phone contact info
            const members = usersList
              .filter((m: any) => m.phone)
              .map((m: any) => ({
                id: m.id,
                firstName: m.firstName || '',
                lastName: m.lastName || '',
                role: m.role || '',
                phone: m.phone || '',
                email: m.email || '',
              }));
            setTeamMembers(members);
          }
        }
      } catch (error) {
        console.error('Error loading tenant/team data:', error);
      }
    };

    loadTenantAndTeam();
  }, []);

  // Load messages for selected conversation
  const loadMessages = async (conversationId: string, allIds?: string[], silent = false) => {
    if (!silent) setIsLoadingMessages(true);

    try {
      const idsQuery = allIds && allIds.length > 0 ? `?allIds=${allIds.join(',')}` : '';
      const response = await fetch(`/api/v1/whatsapp-ai/conversations/${conversationId}/messages${idsQuery}`);
      const data = await response.json();

      if (data.success) {
        setMessages(data.data);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Periodically refresh messages for selected conversation
  useEffect(() => {
    if (!selectedConversation) return;

    const interval = setInterval(() => {
      loadMessages(selectedConversation.id, selectedConversation.allConversationIds, true);
    }, 10000); // Refresh every 10 seconds silent

    return () => clearInterval(interval);
  }, [selectedConversation]);

  // Handle conversation selection
  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    loadMessages(conversation.id, conversation.allConversationIds);
  };

  // Export staff contacts to vCard (like WhatsApp)
  const exportContactsToVCard = () => {
    try {
      console.log('Exporting vCard, teamMembers count:', teamMembers.length);

      if (teamMembers.length === 0) {
        alert('Tidak ada data staff untuk di-export. Pastikan staff sudah terdaftar dengan nomor HP.');
        return;
      }

      // Create vCard content for each staff member
      const vCards = teamMembers.map((member, index) => {
        const fullName = `${member.firstName} ${member.lastName || ''}`.trim();
        const phone = member.phone || '';
        const email = member.email || '';
        const org = member.role || 'Tim';

        // vCard 3.0 format
        return `BEGIN:VCARD
VERSION:3.0
FN:${fullName}
N:${member.lastName || ''};${member.firstName};;;
TEL;TYPE=CELL:${phone}
EMAIL;TYPE=WORK:${email}
ORG:${org}
TITLE:${org}
END:VCARD`;
      });

      // Combine all vCards into one file
      const vCardContent = vCards.join('\n');
      console.log('vCard content length:', vCardContent.length);

      // Create blob and download
      const blob = new Blob([vCardContent], { type: 'text/vcard;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().split('T')[0];
      link.setAttribute('href', url);
      link.setAttribute('download', `staff-contacts-${timestamp}.vcf`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('vCard export completed successfully');
    } catch (error) {
      console.error('Error exporting vCard:', error);
      alert('Gagal mengekspor kontak: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Export staff contacts to CSV
  const exportContactsToCSV = () => {
    if (teamMembers.length === 0) {
      alert('Tidak ada data staff untuk di-export');
      return;
    }

    // Create CSV content for staff contacts
    const headers = ['No', 'Nama Depan', 'Nama Belakang', 'Role', 'No HP', 'Email'];
    const rows = teamMembers.map((member, index) => [
      index + 1,
      member.firstName,
      member.lastName || '-',
      member.role || '-',
      member.phone || '-',
      member.email || '-',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `staff-contacts-${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export conversations to CSV
  const exportToCSV = () => {
    // Get filtered conversations based on current filter
    const dataToExport = filterType === 'all'
      ? conversations.filter(c => !(c.isEscalated && c.status === 'closed'))
      : filterType === 'customer'
        ? conversations.filter(c => !c.isStaff && !(c.isEscalated && c.status === 'closed'))
        : filterType === 'staff'
          ? conversations.filter(c => c.isStaff)
          : conversations.filter(c => c.isEscalated && c.status !== 'closed');

    if (dataToExport.length === 0) {
      alert('Tidak ada data untuk di-export');
      return;
    }

    // Create CSV content
    const headers = ['No', 'No. HP', 'Nama', 'Tipe', 'Status', 'Intent', 'Pesan Terakhir', 'Jumlah Pesan', 'Escalated'];
    const rows = dataToExport.map((conv, index) => [
      index + 1,
      conv.customerPhone,
      conv.customerName || '-',
      conv.isStaff ? 'Tim' : 'Customer',
      conv.status,
      conv.lastIntent || '-',
      new Date(conv.lastMessageAt).toLocaleString('id-ID'),
      conv.messageCount,
      conv.isEscalated ? 'Ya' : 'Tidak',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `conversations-${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Scroll to bottom when messages change - REMOVED per user request for manual scroll
  /*
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  */

  // Close attachment menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target as Node)) {
        setShowAttachmentMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close message menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (messageMenuRef.current && !messageMenuRef.current.contains(event.target as Node)) {
        setActiveMessageMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Delete message handler
  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedConversation || isDeletingMessage) return;

    const confirmDelete = window.confirm('Hapus pesan ini?');
    if (!confirmDelete) {
      setActiveMessageMenu(null);
      return;
    }

    setIsDeletingMessage(true);
    try {
      const response = await fetch(
        `/api/v1/whatsapp-ai/conversations/${selectedConversation.id}/messages?messageId=${messageId}`,
        { method: 'DELETE' }
      );

      const data = await response.json();
      if (data.success) {
        // Remove from local state
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
        setActiveMessageMenu(null);
      } else {
        alert('Gagal menghapus pesan: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Gagal menghapus pesan');
    } finally {
      setIsDeletingMessage(false);
    }
  };

  // Delete conversation handler
  const handleDeleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the conversation

    if (isDeletingConversation) return;

    const confirmDelete = window.confirm('Hapus seluruh percakapan ini? Semua pesan akan dihapus permanen.');
    if (!confirmDelete) return;

    setIsDeletingConversation(conversationId);
    try {
      const response = await fetch(
        `/api/v1/whatsapp-ai/delete-conversation?conversationId=${conversationId}`,
        { method: 'DELETE' }
      );

      const data = await response.json();
      if (data.success) {
        // Remove from local state
        setConversations((prev) => prev.filter((conv) => conv.id !== conversationId));
        // Clear selected if it was the deleted one
        if (selectedConversation?.id === conversationId) {
          setSelectedConversation(null);
          setMessages([]);
          setShowChatOnMobile(false);
        }
      } else {
        alert('Gagal menghapus percakapan: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('Gagal menghapus percakapan');
    } finally {
      setIsDeletingConversation(null);
    }
  };

  // Clear chat history handler
  const handleClearChatHistory = async () => {
    if (!selectedConversation) return;

    if (!window.confirm('Bersihkan seluruh riwayat chat ini? Pesan akan dihapus dari database dashboard (tetap ada di HP customer).')) {
      return;
    }

    try {
      const allIds = selectedConversation.allConversationIds;
      const idsQuery = allIds && allIds.length > 0 ? `&allIds=${allIds.join(',')}` : '';
      const response = await fetch(
        `/api/v1/whatsapp-ai/conversations/${selectedConversation.id}/messages?deleteAll=true${idsQuery}`,
        { method: 'DELETE' }
      );
      const data = await response.json();
      if (data.success) {
        setMessages([]); // Clear local state
        setActiveMessageMenu(null); // Close menu
      } else {
        alert('Gagal membersihkan chat: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error clearing chat:', error);
      alert('Gagal membersihkan chat');
    }
  };

  // Send manual message
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || isSending) return;

    setIsSending(true);
    try {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) return;
      const parsedUser = JSON.parse(storedUser);

      const response = await fetch('/api/v1/whatsapp-ai/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: parsedUser.tenantId,
          conversationId: selectedConversation.id,
          to: selectedConversation.customerPhone,
          message: messageInput,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setMessageInput('');
        // Reload messages with full history - silent to avoid scroll jump
        loadMessages(selectedConversation.id, selectedConversation.allConversationIds, true);
      } else {
        alert('Gagal mengirim pesan: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Gagal mengirim pesan');
    } finally {
      setIsSending(false);
    }
  };

  // Handle attachment selection
  const handleAttachment = (type: string) => {
    setShowAttachmentMenu(false);

    switch (type) {
      case 'foto':
        // Show modal to enter image URL
        setShowImageUrlModal(true);
        break;
      case 'dokumen':
        setShowDocumentModal(true);
        break;
      case 'kontak':
        // Send sales contact info from real tenant/team data
        const tenantName = tenantInfo?.name || 'Showroom';
        const address = tenantInfo?.address || '-';

        // Build contact list from team members
        let contactList = '';
        if (teamMembers.length > 0) {
          contactList = teamMembers
            .slice(0, 5) // Max 5 contacts
            .map((m) => {
              const name = `${m.firstName} ${m.lastName || ''}`.trim();
              const role = m.role?.replace('_', ' ') || '';
              // Format phone: add + prefix if starts with 62
              const phone = m.phone || '';
              const formattedPhone = phone.startsWith('62') ? `+${phone}` : phone;
              return `• ${name}${role ? ` (${role})` : ''}: ${formattedPhone}`;
            })
            .join('\n');
        } else {
          // Fallback to tenant contact
          contactList = tenantInfo?.whatsappNumber || tenantInfo?.phoneNumber || '-';
        }

        const contactMsg = `📞 *Kontak Sales ${tenantName}*\n\nHubungi kami di:\n${contactList}\n\n📍 Alamat: ${address}`;
        setMessageInput(contactMsg);
        break;
      case 'acara':
        const eventTenantName = tenantInfo?.name || 'Showroom';
        const eventMsg = `🎉 *Info Acara ${eventTenantName}*\n\nKami sedang tidak ada acara khusus saat ini.\n\nNantikan promo dan event menarik dari kami!`;
        setMessageInput(eventMsg);
        break;
      case 'emoji':
        // Show emoji picker modal
        setShowEmojiPicker(true);
        break;
      default:
        alert(`Fitur ${type} akan segera hadir!`);
    }
  };

  // Handle file selection from input
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        alert('Tipe file tidak valid. Hanya JPEG, PNG, WebP, dan GIF yang diperbolehkan.');
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File terlalu besar. Maksimal 10MB.');
        return;
      }
      setSelectedFile(file);
    }
  };

  // Send image (either by file upload or URL)
  const handleSendImage = async () => {
    if (!selectedConversation || isSending || isUploading) return;

    // Validate based on mode
    if (imageUploadMode === 'url' && !imageUrlInput.trim()) {
      alert('Masukkan URL gambar');
      return;
    }
    if (imageUploadMode === 'file' && !selectedFile) {
      alert('Pilih file gambar');
      return;
    }

    const storedUser = localStorage.getItem('user');
    if (!storedUser) return;
    const parsedUser = JSON.parse(storedUser);

    let finalImageUrl = imageUrlInput;

    // If file mode, upload first
    if (imageUploadMode === 'file' && selectedFile) {
      setIsUploading(true);
      setUploadProgress('Mengupload gambar...');

      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('tenantId', parsedUser.tenantId);

        const uploadResponse = await fetch('/api/v1/whatsapp-ai/upload', {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadResponse.json();
        if (!uploadData.success) {
          alert('Gagal upload gambar: ' + (uploadData.error || 'Unknown error'));
          setIsUploading(false);
          setUploadProgress('');
          return;
        }

        finalImageUrl = uploadData.data.url;
        setUploadProgress('Mengirim gambar...');
      } catch (error) {
        console.error('Error uploading image:', error);
        alert('Gagal upload gambar');
        setIsUploading(false);
        setUploadProgress('');
        return;
      }
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/v1/whatsapp-ai/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: parsedUser.tenantId,
          conversationId: selectedConversation.id,
          to: selectedConversation.customerPhone,
          imageUrl: finalImageUrl,
          caption: imageCaptionInput || '',
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Reset all states
        setImageUrlInput('');
        setImageCaptionInput('');
        setSelectedFile(null);
        setShowImageUrlModal(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        loadMessages(selectedConversation.id, undefined, true);
      } else {
        alert('Gagal mengirim foto: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error sending image:', error);
      alert('Gagal mengirim foto');
    } finally {
      setIsSending(false);
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  // Handle document file selection
  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type by extension
      const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
      const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
      if (!allowedExtensions.includes(extension)) {
        alert('Tipe file tidak valid. Hanya PDF, Word, Excel, dan PowerPoint yang diperbolehkan.');
        return;
      }
      // Validate file size (max 25MB)
      if (file.size > 25 * 1024 * 1024) {
        alert('File terlalu besar. Maksimal 25MB.');
        return;
      }
      setSelectedDocument(file);
    }
  };

  // Send document (either by file upload or URL)
  const handleSendDocument = async () => {
    if (!selectedConversation || isSending || isUploadingDocument) return;

    // Validate based on mode
    if (documentUploadMode === 'url' && !documentUrlInput.trim()) {
      alert('Masukkan URL dokumen');
      return;
    }
    if (documentUploadMode === 'file' && !selectedDocument) {
      alert('Pilih file dokumen');
      return;
    }

    const storedUser = localStorage.getItem('user');
    if (!storedUser) return;
    const parsedUser = JSON.parse(storedUser);

    let finalDocumentUrl = documentUrlInput;
    let filename = '';

    // If file mode, upload first
    if (documentUploadMode === 'file' && selectedDocument) {
      setIsUploadingDocument(true);
      setUploadProgress('Mengupload dokumen...');
      filename = selectedDocument.name;

      try {
        const formData = new FormData();
        formData.append('file', selectedDocument);
        formData.append('tenantId', parsedUser.tenantId);

        const uploadResponse = await fetch('/api/v1/whatsapp-ai/upload-document', {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadResponse.json();
        if (!uploadData.success) {
          alert('Gagal upload dokumen: ' + (uploadData.error || 'Unknown error'));
          setIsUploadingDocument(false);
          setUploadProgress('');
          return;
        }

        finalDocumentUrl = uploadData.data.url;
        filename = uploadData.data.filename;
        setUploadProgress('Mengirim dokumen...');
      } catch (error) {
        console.error('Error uploading document:', error);
        alert('Gagal upload dokumen');
        setIsUploadingDocument(false);
        setUploadProgress('');
        return;
      }
    } else {
      // For URL mode, extract filename from URL
      try {
        const urlPath = new URL(documentUrlInput).pathname;
        filename = urlPath.split('/').pop() || 'document';
      } catch {
        filename = 'document';
      }
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/v1/whatsapp-ai/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: parsedUser.tenantId,
          conversationId: selectedConversation.id,
          to: selectedConversation.customerPhone,
          documentUrl: finalDocumentUrl,
          filename: filename,
          caption: documentCaptionInput || '',
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Reset all states
        setDocumentUrlInput('');
        setDocumentCaptionInput('');
        setSelectedDocument(null);
        setShowDocumentModal(false);
        if (documentInputRef.current) {
          documentInputRef.current.value = '';
        }
        loadMessages(selectedConversation.id);
      } else {
        alert('Gagal mengirim dokumen: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error sending document:', error);
      alert('Gagal mengirim dokumen');
    } finally {
      setIsSending(false);
      setIsUploadingDocument(false);
      setUploadProgress('');
    }
  };

  // Filter conversations
  // IMPORTANT: Closed escalated conversations are hidden from "Semua" (soft deleted)
  // Only active conversations should appear in the main list
  const filteredConversations = conversations.filter((conv) => {
    // Skip closed escalated conversations in "all" view (they are considered resolved/done)
    const isClosedEscalated = conv.isEscalated && conv.status === 'closed';

    const matchesType =
      // All: show everything EXCEPT closed escalated (those are soft deleted from main view)
      (filterType === 'all' && !isClosedEscalated) ||
      (filterType === 'customer' && !conv.isStaff && !isClosedEscalated) ||
      (filterType === 'staff' && conv.isStaff && !isClosedEscalated) ||
      // Escalated: only show ACTIVE escalated (not closed/resolved)
      (filterType === 'escalated' && conv.isEscalated && conv.status !== 'closed');

    const matchesSearch =
      conv.customerPhone.includes(searchTerm) ||
      conv.customerName?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesType && matchesSearch;
  });

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('id-ID');
  };

  // Format WhatsApp JID to readable phone number
  // Handles both valid phone numbers and LID (Linked IDs) that aren't real phone numbers
  // Format phone number for display
  // API already filters out LID-only conversations, so we just format the number
  const formatPhoneNumber = (phone: string): string => {
    if (!phone) return '-';

    // Remove @lid, @s.whatsapp.net, or other WhatsApp suffixes
    let cleaned = phone.split('@')[0];

    // Remove any device suffix (e.g., :123)
    cleaned = cleaned.split(':')[0];

    // Extract phone number - remove any non-digits
    const digits = cleaned.replace(/\D/g, '');

    // If no digits, return original
    if (!digits) {
      return phone || '-';
    }

    // If starts with 62 (Indonesia), format nicely
    if (digits.startsWith('62') && digits.length >= 10 && digits.length <= 14) {
      const localNumber = digits.substring(2);
      // Format: +62 812 3456 7890
      if (localNumber.length >= 9) {
        const p1 = localNumber.substring(0, 3);
        const p2 = localNumber.substring(3, 7);
        const p3 = localNumber.substring(7);
        return `+62 ${p1} ${p2} ${p3}`.trim();
      }
      return `+62 ${localNumber}`;
    }

    // For any other number, show with + prefix if long enough
    if (digits.length >= 10 && digits.length <= 15) {
      return `+${digits}`;
    }

    // Short numbers - return as is
    return digits;
  };

  const getIntentBadgeColor = (intent?: string) => {
    if (!intent) return 'bg-gray-100 text-gray-800';
    if (intent.startsWith('customer')) return 'bg-blue-100 text-blue-800';
    if (intent.startsWith('staff')) return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  // Generate avatar color and initials based on phone/name
  const getAvatarProps = (phone: string, name?: string, isStaff?: boolean) => {
    // Color palette - WhatsApp-like colors
    const colors = [
      'bg-gradient-to-br from-pink-400 to-pink-600',
      'bg-gradient-to-br from-purple-400 to-purple-600',
      'bg-gradient-to-br from-indigo-400 to-indigo-600',
      'bg-gradient-to-br from-blue-400 to-blue-600',
      'bg-gradient-to-br from-cyan-400 to-cyan-600',
      'bg-gradient-to-br from-teal-400 to-teal-600',
      'bg-gradient-to-br from-green-400 to-green-600',
      'bg-gradient-to-br from-lime-400 to-lime-600',
      'bg-gradient-to-br from-yellow-400 to-yellow-600',
      'bg-gradient-to-br from-orange-400 to-orange-600',
      'bg-gradient-to-br from-red-400 to-red-600',
      'bg-gradient-to-br from-rose-400 to-rose-600',
    ];

    // Generate consistent color index from phone number
    const phoneDigits = phone.replace(/\D/g, '');
    let hash = 0;
    for (let i = 0; i < phoneDigits.length; i++) {
      hash = ((hash << 5) - hash) + phoneDigits.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    const colorIndex = Math.abs(hash) % colors.length;

    // Generate initials
    let initials = '';
    if (name && name.trim()) {
      // Get first letters of first 2 words
      const words = name.trim().split(/\s+/);
      initials = words.slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
    } else {
      // Use last 2 digits of phone number
      // API already filters out LID-only conversations
      initials = phoneDigits.slice(-2) || '?';
    }

    return {
      color: colors[colorIndex],
      initials: initials || '?',
      isStaff: isStaff || false,
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  // Handle conversation selection dengan mobile support
  const handleSelectConversationMobile = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    loadMessages(conversation.id, conversation.allConversationIds);
    setShowChatOnMobile(true);
    // Hide notifications count for this convo locally
  };

  // Back to list on mobile
  const handleBackToList = () => {
    setShowChatOnMobile(false);
  };

  return (
    <div className="p-3 md:p-4 h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Header - Responsive with left margin for hamburger menu */}
      <div className="mb-3 md:mb-4 flex items-center justify-between ml-10 md:ml-0">
        <div>
          <div className="flex items-center gap-2 md:gap-4">
            <Link href="/dashboard/whatsapp-ai" className="text-blue-600 hover:text-blue-800 text-xs md:text-sm whitespace-nowrap">
              ← Back
            </Link>
            <h1 className="text-base md:text-xl font-bold text-gray-900">Conversations</h1>
          </div>
          <p className="text-gray-500 text-[10px] md:text-xs mt-0.5 hidden sm:block">Monitor customer chats dan staff commands</p>
        </div>
        <div className="flex gap-2">
          {/* Export buttons hidden - moved to attachment menu */}
        </div>
      </div>

      {/* Main Content - Mobile: stack, Desktop: side-by-side */}
      <div className="flex-1 flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 overflow-hidden min-h-0">
        {/* Conversations List - Hidden on mobile when chat is open */}
        <div className={`${showChatOnMobile ? 'hidden' : 'flex'} md:flex md:col-span-4 bg-white rounded-lg shadow-sm border border-gray-200 flex-col overflow-hidden flex-1 md:flex-none`}>
          {/* Filters - Responsive */}
          <div className="p-3 md:p-3 border-b border-gray-200">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nomor atau nama..."
              className="w-full px-3 py-2 md:py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent mb-2"
            />
            <div className="flex flex-wrap gap-1.5 md:gap-1">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 md:px-2 md:py-0.5 rounded-full text-xs font-medium ${filterType === 'all'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Semua ({conversations.filter(c => !(c.isEscalated && c.status === 'closed')).length})
              </button>
              <button
                onClick={() => setFilterType('customer')}
                className={`px-3 py-1 md:px-2 md:py-0.5 rounded-full text-xs font-medium ${filterType === 'customer'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Customer
              </button>
              <button
                onClick={() => setFilterType('staff')}
                className={`px-3 py-1 md:px-2 md:py-0.5 rounded-full text-xs font-medium ${filterType === 'staff'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Tim
              </button>
              <button
                onClick={() => setFilterType('escalated')}
                className={`px-3 py-1 md:px-2 md:py-0.5 rounded-full text-xs font-medium ${filterType === 'escalated'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Escalated ({conversations.filter(c => c.isEscalated && c.status !== 'closed').length})
              </button>
            </div>
          </div>

          {/* Conversation List - Better spacing for mobile */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                <p>Tidak ada percakapan</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversationMobile(conv)}
                  className={`px-4 py-3 md:px-3 md:py-2 border-b border-gray-100 cursor-pointer hover:bg-gray-50 active:bg-gray-100 group ${selectedConversation?.id === conv.id ? 'bg-green-50' : ''
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center min-w-0 flex-1">
                      {(() => {
                        const avatar = getAvatarProps(conv.customerPhone, conv.customerName, conv.isStaff);
                        const profilePic = profilePictures[conv.customerPhone];
                        return (
                          <div className="relative w-10 h-10 md:w-8 md:h-8 mr-3 md:mr-2 flex-shrink-0">
                            {profilePic ? (
                              <img
                                src={profilePic}
                                alt=""
                                className="w-full h-full rounded-full object-cover shadow-sm"
                                onError={(e) => {
                                  // Fallback to initials on image load error
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div
                              className={`${profilePic ? 'hidden' : ''} w-full h-full rounded-full flex items-center justify-center ${avatar.color} text-white font-semibold text-sm md:text-xs shadow-sm`}
                            >
                              {avatar.initials}
                            </div>
                            <div
                              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 md:w-3 md:h-3 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${whatsAppStatus[conv.customerPhone.replace(/@.*$/, '').replace(/:/g, '').replace(/[^0-9]/g, '')]
                                ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]'
                                : 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]'
                                } animate-pulse`}
                              title={whatsAppStatus[conv.customerPhone.replace(/@.*$/, '').replace(/:/g, '').replace(/[^0-9]/g, '')] ? 'WhatsApp Terdaftar (Active)' : 'WhatsApp Tidak Terdaftar'}
                            >
                              {conv.isStaff && (
                                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                      <div className="min-w-0 flex-1 overflow-visible">
                        <div className="flex items-center gap-1">
                          <h3 className="font-medium text-gray-900 text-xs md:text-sm whitespace-nowrap">
                            {formatPhoneNumber(conv.customerPhone)}
                          </h3>
                          {conv.hasRealPhone && (
                            <span title="Verified WhatsApp">
                              <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                              </svg>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 md:gap-1 mt-1 md:mt-0.5 flex-wrap">
                          <span
                            className={`inline-block px-2 py-0.5 md:px-1.5 md:py-0 rounded text-[11px] md:text-[10px] font-medium ${getIntentBadgeColor(
                              conv.lastIntent
                            )}`}
                          >
                            {conv.lastIntent?.replace('customer_', '').replace('staff_', '') || '?'}
                          </span>
                          {conv.isEscalated && (
                            <span className="inline-block px-2 py-0.5 md:px-1.5 md:py-0 bg-red-100 text-red-800 rounded text-[11px] md:text-[10px] font-medium">
                              Esc
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3 md:ml-2">
                      {/* Delete conversation button */}
                      <button
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        disabled={isDeletingConversation === conv.id}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                        title="Hapus chat"
                      >
                        {isDeletingConversation === conv.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-500 border-t-transparent"></div>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                      <div className="text-right">
                        <p className="text-[11px] md:text-[10px] text-gray-500">{formatTime(conv.lastMessageAt)}</p>
                        {conv.unreadCount > 0 && (
                          <span className="inline-block mt-1 md:mt-0.5 px-2 py-0.5 md:px-1.5 md:py-0 bg-green-600 text-white text-[11px] md:text-[10px] rounded-full">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Message Thread - Hidden on mobile when chat list is shown */}
        <div className={`${showChatOnMobile ? 'flex' : 'hidden'} md:flex md:col-span-8 bg-white rounded-lg shadow-sm border border-gray-200 flex-col overflow-hidden flex-1 md:flex-none`}>
          {selectedConversation ? (
            <>
              {/* Conversation Header - Responsive with back button for mobile */}
              <div className="px-3 md:px-3 py-3 md:py-2 border-b border-gray-200 bg-[#f0f2f5]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {/* Back button - only visible on mobile */}
                    <button
                      onClick={handleBackToList}
                      className="md:hidden mr-2 p-1.5 -ml-1 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-full"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    {(() => {
                      const avatar = getAvatarProps(selectedConversation.customerPhone, selectedConversation.customerName, selectedConversation.isStaff);
                      const profilePic = profilePictures[selectedConversation.customerPhone];
                      return (
                        <div className="relative w-10 h-10 md:w-8 md:h-8 mr-3 md:mr-2">
                          {profilePic ? (
                            <img
                              src={profilePic}
                              alt=""
                              className="w-full h-full rounded-full object-cover shadow-sm"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div
                            className={`${profilePic ? 'hidden' : ''} w-full h-full rounded-full flex items-center justify-center ${avatar.color} text-white font-semibold text-sm md:text-xs shadow-sm`}
                          >
                            {avatar.initials}
                          </div>
                          <div
                            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 md:w-3 md:h-3 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${whatsAppStatus[selectedConversation.customerPhone.replace(/@.*$/, '').replace(/:/g, '').replace(/[^0-9]/g, '')] ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]'
                              } animate-pulse`}
                          >
                            {selectedConversation.isStaff && (
                              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">
                        {formatPhoneNumber(selectedConversation.customerPhone)}
                      </h2>
                      <p className="text-xs text-gray-500">
                        {selectedConversation.isStaff ? (() => {
                          const member = teamMembers.find(m =>
                            m.phone?.replace(/\D/g, '') === selectedConversation.customerPhone.replace(/\D/g, '') ||
                            selectedConversation.customerPhone.includes(m.phone?.replace(/\D/g, '') || 'XYZ')
                          );
                          return member ? (member.role === 'SALES' ? 'Sales / Staff' : member.role) : 'Tim';
                        })() : 'Customer'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 md:gap-2">
                    <button
                      onClick={() => setIsChatSearchActive(!isChatSearchActive)}
                      className={`p-1.5 md:p-1 rounded-full transition-colors ${isChatSearchActive ? 'bg-green-100 text-green-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
                      title="Cari dalam chat"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>

                    {/* Conversations Options Menu */}
                    <div className="relative group">
                      <button
                        onClick={() => setActiveMessageMenu(activeMessageMenu === 'header-options' ? null : 'header-options')}
                        className={`p-1.5 md:p-1 rounded-full transition-colors ${activeMessageMenu === 'header-options' ? 'bg-gray-200 text-gray-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>

                      {activeMessageMenu === 'header-options' && (
                        <div className="absolute right-0 mt-2 w-52 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-[60]">
                          <button
                            onClick={() => {
                              setShowInfoModal(true);
                              setActiveMessageMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3 text-sm text-gray-700"
                          >
                            <span className="w-5 flex justify-center text-blue-500">ℹ️</span> Info {selectedConversation.isStaff ? 'Tim' : 'Customer'}
                          </button>
                          <button
                            onClick={() => {
                              setIsSelectionMode(true);
                              setActiveMessageMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3 text-sm text-gray-700"
                          >
                            <span className="w-5 flex justify-center text-green-500">✅</span> Pilih pesan
                          </button>
                          <button
                            onClick={() => {
                              const phone = selectedConversation.customerPhone;
                              setIsFavorited(prev => ({ ...prev, [phone]: !prev[phone] }));
                              setActiveMessageMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3 text-sm text-gray-700"
                          >
                            <span className={`w-5 flex justify-center text-red-500 transition-transform ${isFavorited[selectedConversation.customerPhone] ? 'scale-125' : ''}`}>
                              {isFavorited[selectedConversation.customerPhone] ? '❤️' : '🤍'}
                            </span>
                            {isFavorited[selectedConversation.customerPhone] ? 'Hapus dari favorit' : 'Tambah ke favorit'}
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Tutup/Selesaikan percakapan dengan ${formatPhoneNumber(selectedConversation.customerPhone)}?`)) {
                                // Mock status update
                                alert('Percakapan ditandai sebagai selesai');
                              }
                              setActiveMessageMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3 text-sm text-gray-700 border-b border-gray-100"
                          >
                            <span className="w-5 flex justify-center text-gray-500">❌</span> Tutup chat
                          </button>
                          <button
                            onClick={(e) => {
                              handleDeleteConversation(selectedConversation.id, e as any);
                              setActiveMessageMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3 text-sm text-red-600 font-medium"
                          >
                            <span className="w-5 flex justify-center">🗑️</span> Hapus semua chat
                          </button>
                          <button
                            onClick={handleClearChatHistory}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3 text-sm text-gray-600"
                          >
                            <span className="w-5 flex justify-center">🧹</span> Bersihkan riwayat chat
                          </button>
                        </div>
                      )}
                    </div>

                    <span
                      className={`px-2 py-0.5 md:py-0.5 rounded-full text-[11px] md:text-[10px] font-medium ${selectedConversation.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                        }`}
                    >
                      {selectedConversation.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Messages Area with custom background */}
              <div
                className="flex-1 overflow-y-auto p-4 md:p-3 relative"
                style={{
                  backgroundColor: '#e5ddd5',
                  backgroundImage: 'url("/images/chat-bg-watermark.png")',
                  backgroundSize: '400px',
                  backgroundRepeat: 'repeat',
                  backgroundBlendMode: 'overlay'
                }}
              >
                {/* Background Overlay to ensure readability */}
                <div className="absolute inset-0 bg-[#e5ddd5]/60 pointer-events-none z-0"></div>

                {/* Chat Search Bar */}
                {isChatSearchActive && selectedConversation && (
                  <div className="sticky top-0 left-0 right-0 bg-white shadow-md p-2 z-[40] flex items-center gap-2 mb-2 animate-in slide-in-from-top-4 duration-200">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={chatSearchTerm}
                        onChange={(e) => setChatSearchTerm(e.target.value)}
                        placeholder="Cari pesan..."
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        autoFocus
                      />
                      <svg
                        className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <button
                      onClick={() => {
                        setIsChatSearchActive(false);
                        setChatSearchTerm('');
                      }}
                      className="text-sm text-gray-500 hover:text-gray-700 font-medium px-2"
                    >
                      Batal
                    </button>
                  </div>
                )}

                {/* Message Selection Bar */}
                {isSelectionMode && (
                  <div className="sticky top-0 left-0 right-0 bg-green-600 text-white p-2 z-[40] flex items-center justify-between px-4 mb-2 animate-in slide-in-from-top-4 duration-200 shadow-md">
                    <div className="flex items-center gap-4">
                      <button onClick={() => setIsSelectionMode(false)} className="hover:bg-green-700 p-1 rounded transition-colors">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <span className="text-sm font-semibold">{selectedMessageIds.length} pesan terpilih</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {selectedMessageIds.length > 0 && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Hapus ${selectedMessageIds.length} pesan terpilih?`)) {
                              selectedMessageIds.forEach(id => handleDeleteMessage(id));
                              setSelectedMessageIds([]);
                              setIsSelectionMode(false);
                            }
                          }}
                          className="p-1 px-3 bg-red-500 hover:bg-red-600 rounded text-xs font-bold transition-colors flex items-center gap-1.5"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Hapus Terpilih
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedMessageIds([]);
                          setIsSelectionMode(false);
                        }}
                        className="text-white/80 hover:text-white text-xs"
                      >
                        Selesai
                      </button>
                    </div>
                  </div>
                )}

                <div className="relative z-10 w-full flex flex-col space-y-3 md:space-y-2">
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full min-h-[200px]">
                      <div className="animate-spin rounded-full h-8 w-8 md:h-6 md:w-6 border-b-2 border-green-600"></div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-12 text-sm">
                      <p>Belum ada pesan</p>
                    </div>
                  ) : (
                    <>
                      {(() => {
                        const filteredMessages = chatSearchTerm
                          ? messages.filter(msg =>
                            msg.content.toLowerCase().includes(chatSearchTerm.toLowerCase())
                          )
                          : messages;

                        return filteredMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.direction === 'inbound' ? 'justify-start' : 'justify-end'} group/row items-center gap-2`}
                          >
                            {/* Selection Checkbox */}
                            {isSelectionMode && (
                              <div className={`flex items-center justify-center transition-all ${msg.direction === 'inbound' ? 'order-first' : 'order-last'}`}>
                                <input
                                  type="checkbox"
                                  checked={selectedMessageIds.includes(msg.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedMessageIds(prev => [...prev, msg.id]);
                                    } else {
                                      setSelectedMessageIds(prev => prev.filter(id => id !== msg.id));
                                    }
                                  }}
                                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
                                />
                              </div>
                            )}

                            {/* Message bubble */}
                            <div className="relative group max-w-[85%] md:max-w-[75%]">
                              <div
                                className={`rounded-lg px-3 py-2 md:px-2.5 md:py-1.5 shadow-sm transition-colors ${selectedMessageIds.includes(msg.id) ? 'ring-2 ring-green-500 bg-green-50' : ''} ${msg.direction === 'inbound'
                                  ? 'bg-white text-gray-900 rounded-tl-none'
                                  : msg.aiResponse
                                    ? 'bg-[#dcf8c6] text-gray-900 rounded-tr-none'
                                    : 'bg-[#d9fdd3] text-gray-900 rounded-tr-none'
                                  }`}
                                onClick={() => {
                                  if (isSelectionMode) {
                                    if (selectedMessageIds.includes(msg.id)) {
                                      setSelectedMessageIds(prev => prev.filter(id => id !== msg.id));
                                    } else {
                                      setSelectedMessageIds(prev => [...prev, msg.id]);
                                    }
                                  }
                                }}
                              >
                                {msg.direction === 'inbound' && (
                                  <div className="flex items-center space-x-1.5 md:space-x-1 mb-1 md:mb-0.5">
                                    <span className="text-[11px] md:text-[10px] font-semibold text-green-700">
                                      👨‍💼 →
                                    </span>
                                    <span className="text-[11px] md:text-[10px] font-bold text-gray-800">
                                      {(() => {
                                        // Priority: Check team member list first for accuracy
                                        if (selectedConversation?.isStaff || msg.intent?.includes('staff') || msg.intent?.includes('owner') || msg.intent?.includes('admin')) {
                                          const phone = selectedConversation?.customerPhone;
                                          if (phone) {
                                            const member = teamMembers.find(m =>
                                              (m.phone && m.phone.replace(/\D/g, '') === phone.replace(/\D/g, '')) ||
                                              phone.includes(m.phone?.replace(/\D/g, '') || 'XYZ')
                                            );
                                            if (member) {
                                              if (member.role === 'OWNER') return 'Owner';
                                              if (member.role === 'ADMIN') return 'Admin';
                                              return 'Staff';
                                            }
                                          }
                                        }

                                        // Fallback to intent (less reliable)
                                        const intent = msg.intent || '';
                                        if (intent.includes('owner')) return 'Owner';
                                        if (intent.includes('admin')) return 'Admin';
                                        if (intent.includes('staff') || msg.senderType === 'staff') return 'Staff';

                                        return 'Customer';
                                      })()}
                                    </span>
                                    {msg.intent && (
                                      <span className="text-[11px] md:text-[10px] text-gray-500">
                                        • {msg.intent.replace('customer_', '').replace('staff_', '')}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {msg.direction === 'outbound' && (
                                  <div className="flex items-center space-x-1.5 md:space-x-1 mb-1 md:mb-0.5">
                                    <span className="text-[11px] md:text-[10px] font-semibold text-blue-700">
                                      {msg.senderType === 'ai' || msg.aiResponse ? '🤖 →' : '👨‍💼 →'}
                                    </span>
                                    <span className="text-[11px] md:text-[10px] font-bold text-gray-800">
                                      {msg.senderType === 'ai' || msg.aiResponse
                                        ? (aiConfig?.aiName || 'AI Assistant')
                                        : (() => {
                                          const intent = msg.intent || '';
                                          if (intent.includes('owner')) return 'Owner';
                                          if (intent.includes('admin')) return 'Admin';
                                          // Check if it's a staff member responding
                                          if (msg.senderType === 'staff' || intent.includes('staff')) {
                                            // Ideally we should know WHICH staff, but for outbound we usually assume it's the system user or linked account
                                            // If we have metadata about the sender, use it. Otherwise, default to Staff.
                                            return 'Staff';
                                          }
                                          return 'Staff';
                                        })()
                                      }
                                    </span>
                                  </div>
                                )}
                                <p className="text-[13px] md:text-xs whitespace-pre-wrap break-words leading-relaxed pr-5">{msg.content}</p>
                                <div className="flex items-center justify-end mt-1 md:mt-0.5 space-x-1">
                                  <span className="text-[10px] md:text-[9px] text-gray-500">
                                    {(() => {
                                      const d = new Date(msg.createdAt);
                                      const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
                                      const date = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'numeric', year: 'numeric' });
                                      return `[${time}, ${date}]`;
                                    })()}
                                  </span>
                                  {msg.direction === 'outbound' && (
                                    <span className="text-blue-500 text-[11px] md:text-[10px]">✓✓</span>
                                  )}
                                </div>

                                {/* Dropdown trigger button - appears on hover/tap */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMessageMenu(activeMessageMenu === msg.id ? null : msg.id);
                                  }}
                                  className={`absolute top-1 right-1 p-1 rounded hover:bg-black/10 transition-opacity ${activeMessageMenu === msg.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 active:opacity-100'
                                    }`}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>

                              {/* Dropdown menu */}
                              {activeMessageMenu === msg.id && (
                                <div
                                  ref={messageMenuRef}
                                  className="absolute top-8 right-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[120px] z-50"
                                >
                                  <button
                                    onClick={() => handleDeleteMessage(msg.id)}
                                    disabled={isDeletingMessage}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center space-x-2 text-red-600 disabled:opacity-50"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    <span className="text-sm">{isDeletingMessage ? 'Menghapus...' : 'Hapus'}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ));
                      })()}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>
              </div>

              {/* Message Input - Responsive */}
              <div className="px-3 md:px-2 py-3 md:py-2 border-t border-gray-200 bg-[#f0f2f5]">
                <div className="flex items-center space-x-2 md:space-x-2">
                  {/* ... and so on until the end of this block */}
                  <div className="relative" ref={attachmentMenuRef}>
                    <button
                      onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                      className="p-2 md:p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
                      title="Lampiran"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>

                    {/* Attachment Menu */}
                    {showAttachmentMenu && (
                      <div className="absolute bottom-12 left-0 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[200px] z-50">
                        <button
                          onClick={() => handleAttachment('dokumen')}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center space-x-3"
                        >
                          <span className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">📄</span>
                          <div>
                            <p className="text-sm font-medium">Dokumen</p>
                            <p className="text-xs text-gray-500">PDF, Word, Excel</p>
                          </div>
                        </button>
                        <button
                          onClick={() => handleAttachment('foto')}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center space-x-3"
                        >
                          <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">📷</span>
                          <div>
                            <p className="text-sm font-medium">Foto</p>
                            <p className="text-xs text-gray-500">JPG, PNG, GIF</p>
                          </div>
                        </button>
                        <button
                          onClick={() => handleAttachment('kontak')}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center space-x-3"
                        >
                          <span className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">👤</span>
                          <div>
                            <p className="text-sm font-medium">Kontak</p>
                            <p className="text-xs text-gray-500">Kirim kontak sales</p>
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            exportContactsToVCard();
                            setShowAttachmentMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center space-x-3"
                        >
                          <span className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">📇</span>
                          <div>
                            <p className="text-sm font-medium">Export Kontak Tim</p>
                            <p className="text-xs text-gray-500">Download vCard semua tim</p>
                          </div>
                        </button>
                        <button
                          onClick={() => handleAttachment('acara')}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center space-x-3"
                        >
                          <span className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">📅</span>
                          <div>
                            <p className="text-sm font-medium">Acara</p>
                            <p className="text-xs text-gray-500">Info acara showroom</p>
                          </div>
                        </button>
                        <button
                          onClick={() => handleAttachment('emoji')}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center space-x-3"
                        >
                          <span className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">😊</span>
                          <div>
                            <p className="text-sm font-medium">Stiker & Emoji</p>
                            <p className="text-xs text-gray-500">Emotikon</p>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Message Input */}
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ketik pesan..."
                    className="flex-1 px-4 py-2.5 md:px-3 md:py-1.5 text-sm bg-white border border-gray-300 rounded-full focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />

                  {/* Send Button */}
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || isSending}
                    className="p-2.5 md:p-1.5 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Kirim"
                  >
                    {isSending ? (
                      <div className="animate-spin rounded-full h-5 w-5 md:h-4 md:w-4 border-b-2 border-white"></div>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-4 md:w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="hidden md:flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <p className="text-4xl mb-2">💬</p>
                <p className="text-sm">Pilih percakapan untuk melihat pesan</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input for images */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
      />

      {/* Hidden file input for documents */}
      <input
        type="file"
        ref={documentInputRef}
        onChange={handleDocumentSelect}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
        className="hidden"
      />

      {/* Image Upload Modal */}
      {
        showImageUrlModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">📷 Kirim Foto</h3>

              {/* Mode Tabs */}
              <div className="flex mb-4 border-b border-gray-200">
                <button
                  onClick={() => setImageUploadMode('file')}
                  className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${imageUploadMode === 'file'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  📱 Upload File
                </button>
                <button
                  onClick={() => setImageUploadMode('url')}
                  className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${imageUploadMode === 'url'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  🔗 Paste URL
                </button>
              </div>

              <div className="space-y-4">
                {/* File Upload Mode */}
                {imageUploadMode === 'file' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pilih Gambar *
                    </label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors"
                    >
                      {selectedFile ? (
                        <div className="space-y-2">
                          <div className="text-4xl">🖼️</div>
                          <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                          <p className="text-xs text-gray-500">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFile(null);
                              if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                              }
                            }}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Hapus
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-4xl">📤</div>
                          <p className="text-sm text-gray-600">
                            Klik untuk memilih gambar
                          </p>
                          <p className="text-xs text-gray-400">
                            JPG, PNG, WebP, GIF (maks 10MB)
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Bisa dari smartphone, laptop, atau penyimpanan lokal
                    </p>
                  </div>
                )}

                {/* URL Mode */}
                {imageUploadMode === 'url' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      URL Gambar *
                    </label>
                    <input
                      type="url"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Paste URL gambar dari Google Drive, Dropbox, atau website lain
                    </p>
                  </div>
                )}

                {/* Caption - shared for both modes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Caption (opsional)
                  </label>
                  <input
                    type="text"
                    value={imageCaptionInput}
                    onChange={(e) => setImageCaptionInput(e.target.value)}
                    placeholder="Keterangan gambar..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Progress indicator */}
              {(isUploading || isSending) && uploadProgress && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                    <span className="text-sm text-blue-700">{uploadProgress}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowImageUrlModal(false);
                    setImageUrlInput('');
                    setImageCaptionInput('');
                    setSelectedFile(null);
                    setUploadProgress('');
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  disabled={isUploading || isSending}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleSendImage}
                  disabled={
                    (imageUploadMode === 'file' && !selectedFile) ||
                    (imageUploadMode === 'url' && !imageUrlInput.trim()) ||
                    isSending ||
                    isUploading
                  }
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Mengupload...' : isSending ? 'Mengirim...' : 'Kirim Foto'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Emoji Picker Modal */}
      {
        showEmojiPicker && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 overflow-hidden flex flex-col h-[450px]">
              {/* Header */}
              <div className="flex justify-between items-center p-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-md font-semibold text-gray-700">😊 Pilih Emoji</h3>
                <button
                  onClick={() => setShowEmojiPicker(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 focus:outline-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {/* Category Tabs */}
              <div className="flex overflow-x-auto bg-gray-100 p-1 space-x-1 scrollbar-hide border-b border-gray-200">
                {EMOJI_CATEGORIES.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setActiveEmojiCategory(category.id)}
                    className={`flex-shrink-0 p-2 rounded text-xl transition-all w-10 h-10 flex items-center justify-center ${activeEmojiCategory === category.id
                      ? 'bg-white shadow-sm text-green-600 scale-110'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                      }`}
                    title={category.name}
                  >
                    {category.icon}
                  </button>
                ))}
              </div>

              {/* Emoji Grid */}
              <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
                {EMOJI_CATEGORIES.map(category => (
                  <div key={category.id} className={activeEmojiCategory === category.id ? 'block animate-in fade-in duration-200' : 'hidden'}>
                    <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide sticky top-0 bg-white/95 backdrop-blur-sm py-1 z-10 border-b border-transparent">
                      {category.name}
                    </h4>
                    <div className="grid grid-cols-8 gap-1">
                      {category.emojis.map((emoji, idx) => (
                        <button
                          key={`${category.id}-${idx}`}
                          onClick={() => {
                            setMessageInput((prev) => prev + emoji);
                            // Optionally keep open for multiple insertion
                          }}
                          className="w-9 h-9 flex items-center justify-center text-xl hover:bg-gray-100 rounded-lg cursor-pointer transition-colors active:scale-90"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-2 border-t border-gray-200 bg-gray-50 text-center">
                <p className="text-xs text-gray-400">Klik untuk menambahkan</p>
              </div>
            </div>
          </div>
        )
      }

      {/* Document Upload Modal */}
      {
        showDocumentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">📄 Kirim Dokumen</h3>

              {/* Mode Tabs */}
              <div className="flex mb-4 border-b border-gray-200">
                <button
                  onClick={() => setDocumentUploadMode('file')}
                  className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${documentUploadMode === 'file'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  📱 Upload File
                </button>
                <button
                  onClick={() => setDocumentUploadMode('url')}
                  className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${documentUploadMode === 'url'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  🔗 Paste URL
                </button>
              </div>

              <div className="space-y-4">
                {/* File Upload Mode */}
                {documentUploadMode === 'file' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pilih Dokumen *
                    </label>
                    <div
                      onClick={() => documentInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors"
                    >
                      {selectedDocument ? (
                        <div className="space-y-2">
                          <div className="text-4xl">
                            {selectedDocument?.name?.endsWith('.pdf') ? '📕' :
                              selectedDocument?.name?.match(/\.docx?$/) ? '📘' :
                                selectedDocument?.name?.match(/\.xlsx?$/) ? '📗' :
                                  selectedDocument?.name?.match(/\.pptx?$/) ? '📙' : '📄'}
                          </div>
                          <p className="text-sm font-medium text-gray-900 truncate px-2">{selectedDocument?.name}</p>
                          <p className="text-xs text-gray-500">
                            {selectedDocument ? (selectedDocument.size / 1024 / 1024).toFixed(2) : '0.00'} MB
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDocument(null);
                              if (documentInputRef.current) {
                                documentInputRef.current.value = '';
                              }
                            }}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Hapus
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-4xl">📤</div>
                          <p className="text-sm text-gray-600">
                            Klik untuk memilih dokumen
                          </p>
                          <p className="text-xs text-gray-400">
                            PDF, Word, Excel, PowerPoint (maks 25MB)
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Bisa dari smartphone, laptop, atau penyimpanan lokal
                    </p>
                  </div>
                )}

                {/* URL Mode */}
                {documentUploadMode === 'url' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      URL Dokumen *
                    </label>
                    <input
                      type="url"
                      value={documentUrlInput}
                      onChange={(e) => setDocumentUrlInput(e.target.value)}
                      placeholder="https://drive.google.com/file/..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Paste URL dokumen dari Google Drive, Dropbox, atau website lain
                    </p>
                  </div>
                )}

                {/* Caption - shared for both modes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Keterangan (opsional)
                  </label>
                  <input
                    type="text"
                    value={documentCaptionInput}
                    onChange={(e) => setDocumentCaptionInput(e.target.value)}
                    placeholder="Keterangan dokumen..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Progress indicator */}
              {(isUploadingDocument || isSending) && uploadProgress && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                    <span className="text-sm text-blue-700">{uploadProgress}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowDocumentModal(false);
                    setDocumentUrlInput('');
                    setDocumentCaptionInput('');
                    setSelectedDocument(null);
                    setUploadProgress('');
                    if (documentInputRef.current) {
                      documentInputRef.current.value = '';
                    }
                  }}
                  disabled={isUploadingDocument || isSending}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleSendDocument}
                  disabled={
                    (documentUploadMode === 'file' && !selectedDocument) ||
                    (documentUploadMode === 'url' && !documentUrlInput.trim()) ||
                    isSending ||
                    isUploadingDocument
                  }
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploadingDocument ? 'Mengupload...' : isSending ? 'Mengirim...' : 'Kirim Dokumen'}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Info Modal */}
      {showInfoModal && selectedConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4 text-gray-900">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-gradient-to-r from-green-600 to-green-700 text-white relative">
              <button
                onClick={() => setShowInfoModal(false)}
                className="absolute top-4 right-4 text-white/80 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="flex flex-col items-center">
                {(() => {
                  const avatar = getAvatarProps(selectedConversation.customerPhone, selectedConversation.customerName, selectedConversation.isStaff);
                  const profilePic = profilePictures[selectedConversation.customerPhone];
                  return (
                    <div className="relative w-24 h-24 mb-4">
                      {profilePic ? (
                        <img
                          src={profilePic}
                          alt=""
                          className="w-full h-full rounded-full object-cover border-4 border-white/30 shadow-lg"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : (
                        <div className={`w-full h-full rounded-full flex items-center justify-center ${avatar.color} text-white font-bold text-3xl shadow-lg border-4 border-white/30`}>
                          {avatar.initials}
                        </div>
                      )}
                    </div>
                  );
                })()}
                <h3 className="text-2xl font-bold">{formatPhoneNumber(selectedConversation.customerPhone)}</h3>
                <p className="text-white/80">
                  {selectedConversation.isStaff ? (() => {
                    const member = teamMembers.find(m =>
                      m.phone?.replace(/\D/g, '') === selectedConversation.customerPhone.replace(/\D/g, '') ||
                      selectedConversation.customerPhone.includes(m.phone?.replace(/\D/g, '') || 'XYZ')
                    );
                    return member ? (member.role === 'SALES' ? 'Sales / Staff' : member.role) : 'Anggota Tim';
                  })() : 'Customer'}
                </p>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Status Sesi</p>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${selectedConversation.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    <span className="text-sm font-semibold capitalize">{selectedConversation.status}</span>
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Pesan</p>
                  <p className="text-sm font-semibold">{selectedConversation.messageCount} chat</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 font-bold uppercase block mb-2">Intent Terakhir</label>
                  <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-100">
                    {selectedConversation.lastIntent?.replace('customer_', '') || 'General Inquiry'}
                  </span>
                </div>

                {selectedConversation.lastMessageAt && (
                  <div>
                    <label className="text-xs text-gray-400 font-bold uppercase block mb-1">Terakhir Aktif</label>
                    <p className="text-sm text-gray-700">
                      {new Date(selectedConversation.lastMessageAt).toLocaleDateString('id-ID', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => {
                    const phone = selectedConversation.customerPhone;
                    setIsFavorited(prev => ({ ...prev, [phone]: !prev[phone] }));
                  }}
                  className={`flex-1 py-2.5 rounded-lg border-2 font-bold text-sm transition-all flex items-center justify-center gap-2 ${isFavorited[selectedConversation.customerPhone]
                    ? 'bg-red-50 border-red-500 text-red-600'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                >
                  {isFavorited[selectedConversation.customerPhone] ? '❤️ Favorit' : '🤍 Jadikan Favorit'}
                </button>
                <button
                  onClick={() => {
                    handleDeleteConversation(selectedConversation.id, { stopPropagation: () => { } } as any);
                    setShowInfoModal(false);
                  }}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  🗑️ Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
