import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

type TabKey = 'conversations' | 'world' | 'profile';
type PageKey = 'tabs' | 'chat' | 'mailbox';

type Resident = {
  id: string;
  name: string;
  initial: string;
  relation: string;
  line: string;
  color: string;
  ink: string;
};

type Conversation = {
  id: string;
  name: string;
  initial: string;
  preview: string;
  time: string;
  color: string;
  ink: string;
  meta?: string;
  unread?: boolean;
  human?: boolean;
};

const PALETTE = {
  background: '#F5F0E7',
  paper: '#FFFCF6',
  paperDeep: '#F0E8DA',
  ink: '#29251F',
  muted: '#746B61',
  quiet: '#A2988C',
  line: '#E1D7C8',
  accent: '#A66D3F',
  accentDeep: '#765035',
  accentSoft: '#E7D2B8',
  sage: '#7F8E77',
  sageSoft: '#DDE4D7',
  dusk: '#7B778A',
  duskSoft: '#E1DFE7',
  white: '#FFFFFF',
} as const;

const INITIAL_RESIDENTS: Resident[] = [
  {
    id: 'chaoyan',
    name: '朝颜',
    initial: '朝',
    relation: '温柔而清醒的同行者',
    line: '擅长听见那些没说出口的话',
    color: '#E8D4B8',
    ink: '#704B2D',
  },
  {
    id: 'xiaoman',
    name: '小满',
    initial: '满',
    relation: '喜欢日常小事的朋友',
    line: '会记住风、植物和你的好心情',
    color: '#DCE4D4',
    ink: '#53614C',
  },
  {
    id: 'yanqing',
    name: '砚青',
    initial: '砚',
    relation: '安静可靠的思考者',
    line: '适合一起把复杂的事慢慢想清楚',
    color: '#DDE0E7',
    ink: '#535B6C',
  },
  {
    id: 'wenxi',
    name: '闻溪',
    initial: '溪',
    relation: '自由、坦率的远方来客',
    line: '偶尔带来陌生城市的风',
    color: '#E4D8D0',
    ink: '#6B5044',
  },
];

const CREATED_RESIDENT: Resident = {
  id: 'nanxing',
  name: '南星',
  initial: '星',
  relation: '由你亲手创造的朋友',
  line: '关系会在以后的相处里慢慢长出来',
  color: '#E8DFC7',
  ink: '#6E5A35',
};

const BASE_CONVERSATIONS: Conversation[] = [
  {
    id: 'chaoyan',
    name: '朝颜',
    initial: '朝',
    preview: '今天也可以什么都不做，只在这里待一会儿。',
    time: '09:42',
    color: '#E8D4B8',
    ink: '#704B2D',
    unread: true,
  },
  {
    id: 'xiaoman',
    name: '小满',
    initial: '满',
    preview: '窗台那盆薄荷，好像又长高了一点。',
    time: '昨天',
    color: '#DCE4D4',
    ink: '#53614C',
  },
  {
    id: 'yanqing',
    name: '砚青',
    initial: '砚',
    preview: '你上次说的那件事，我后来又想了想。',
    time: '周二',
    color: '#DDE0E7',
    ink: '#535B6C',
  },
  {
    id: 'wenxi',
    name: '闻溪',
    initial: '溪',
    preview: '还没有说过话，什么时候想来都可以。',
    time: '',
    color: '#E4D8D0',
    ink: '#6B5044',
    meta: '尚未开始',
  },
  {
    id: 'ahe',
    name: '阿禾',
    initial: '禾',
    preview: '等周末有空，再慢慢和我讲。',
    time: '周一',
    color: '#D8E2D2',
    ink: '#4D6048',
    meta: '来访剩余 8 小时',
    human: true,
  },
];

export function CompanionPrototype() {
  const requested = process.env.EXPO_PUBLIC_UI_PREVIEW_SCREEN;
  const initialTab: TabKey =
    requested === 'world' ? 'world' : requested === 'profile' ? 'profile' : 'conversations';
  const [residents, setResidents] = useState(INITIAL_RESIDENTS);
  const [showOnboarding, setShowOnboarding] = useState(
    !requested || requested === 'onboarding',
  );
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [page, setPage] = useState<PageKey>(requested === 'chat' ? 'chat' : 'tabs');
  const [selectedConversation, setSelectedConversation] = useState<Conversation>(
    BASE_CONVERSATIONS[0]!,
  );

  useEffect(() => {
    function applyPreviewUrl(url: string) {
      const match = url.match(/[?&]screen=([^&]+)/);
      const screen = match?.[1] ? decodeURIComponent(match[1]) : '';
      if (screen === 'onboarding') {
        setShowOnboarding(true);
        return;
      }
      if (screen === 'conversations' || screen === 'world' || screen === 'profile') {
        setShowOnboarding(false);
        setPage('tabs');
        setTab(screen);
        return;
      }
      if (screen === 'mailbox' || screen === 'chat') {
        setShowOnboarding(false);
        setPage(screen);
      }
    }

    const subscription = Linking.addEventListener('url', ({ url }) => applyPreviewUrl(url));
    void Linking.getInitialURL().then((url) => {
      if (url?.includes('screen=')) {
        applyPreviewUrl(url);
      }
    });
    return () => subscription.remove();
  }, []);

  function removeResident(id: string) {
    if (residents.length <= 1) {
      return;
    }
    setResidents((current) => current.filter((resident) => resident.id !== id));
  }

  function createResident() {
    if (residents.some((resident) => resident.id === CREATED_RESIDENT.id)) {
      return;
    }
    setResidents((current) => [...current, CREATED_RESIDENT]);
  }

  function openConversation(conversation: Conversation) {
    setSelectedConversation(conversation);
    setPage('chat');
  }

  const conversations = BASE_CONVERSATIONS.filter(
    (item) => item.human || residents.some((resident) => resident.id === item.id),
  );
  if (residents.some((resident) => resident.id === CREATED_RESIDENT.id)) {
    conversations.splice(1, 0, {
      id: 'nanxing',
      name: '南星',
      initial: '星',
      preview: '还没有说过话，先从一句你好开始。',
      time: '',
      color: '#E8DFC7',
      ink: '#6E5A35',
      meta: '新朋友',
    });
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <StatusBar style="dark" />
        {showOnboarding ? (
          <ResidentOnboarding
            onConfirm={() => setShowOnboarding(false)}
            onCreate={createResident}
            onRemove={removeResident}
            residents={residents}
          />
        ) : page === 'chat' ? (
          <ChatPreview conversation={selectedConversation} onBack={() => setPage('tabs')} />
        ) : page === 'mailbox' ? (
          <MailboxScreen onBack={() => setPage('tabs')} />
        ) : (
          <View style={styles.appFrame}>
            <View style={styles.ambientOne} />
            <View style={styles.ambientTwo} />
            <View style={styles.tabContent}>
              {tab === 'conversations' ? (
                <ConversationList conversations={conversations} onOpen={openConversation} />
              ) : null}
              {tab === 'world' ? <WorldScreen /> : null}
              {tab === 'profile' ? (
                <ProfileScreen
                  activeResidents={residents.length}
                  onOpenMailbox={() => setPage('mailbox')}
                />
              ) : null}
            </View>
            <BottomTabs selected={tab} onSelect={setTab} />
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function ResidentOnboarding({
  residents,
  onRemove,
  onCreate,
  onConfirm,
}: {
  residents: Resident[];
  onRemove: (id: string) => void;
  onCreate: () => void;
  onConfirm: () => void;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.floor((Math.min(width, 520) - 52) / 2);
  const hasCreated = residents.some((resident) => resident.id === CREATED_RESIDENT.id);

  return (
    <View style={styles.onboardingScreen}>
      <View style={styles.onboardingGlowA} />
      <View style={styles.onboardingGlowB} />
      <ScrollView
        contentContainerStyle={styles.onboardingContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.onboardingTopRow}>
          <SeedMark />
          <PrototypeBadge />
        </View>
        <Text style={styles.onboardingEyebrow}>欢迎回到自己的世界</Text>
        <Text style={styles.onboardingTitle}>最先来到这里的朋友们</Text>
        <Text style={styles.onboardingSubtitle}>
          留下想一起生活的人。以后还会有新的相遇，也可以创造属于你的朋友。
        </Text>

        <View style={styles.residentGrid}>
          {residents.map((resident) => (
            <View key={resident.id} style={[styles.residentCard, { width: cardWidth }]}>
              <Pressable
                accessibilityLabel={`从初始世界移除${resident.name}`}
                accessibilityRole="button"
                accessibilityState={{ disabled: residents.length <= 1 }}
                disabled={residents.length <= 1}
                hitSlop={8}
                onPress={() => onRemove(resident.id)}
                style={({ pressed }) => [
                  styles.removeButton,
                  residents.length <= 1 && styles.removeButtonDisabled,
                  pressed && styles.softPressed,
                ]}
              >
                <CloseGlyph muted={residents.length <= 1} />
              </Pressable>
              <Avatar resident={resident} size={64} />
              <Text style={styles.residentName}>{resident.name}</Text>
              <Text style={styles.residentRelation}>{resident.relation}</Text>
              <View style={styles.residentDivider} />
              <Text style={styles.residentLine}>{resident.line}</Text>
            </View>
          ))}
          <Pressable
            accessibilityLabel="创建我的 AI 朋友"
            accessibilityRole="button"
            disabled={hasCreated}
            onPress={onCreate}
            style={({ pressed }) => [
              styles.createCard,
              { width: cardWidth },
              hasCreated && styles.createCardDisabled,
              pressed && styles.softPressed,
            ]}
          >
            <View style={styles.createGlyphCircle}>
              {hasCreated ? <CheckGlyph /> : <PlusGlyph color={PALETTE.accentDeep} />}
            </View>
            <Text style={styles.createTitle}>{hasCreated ? '已经来到这里' : '创造一个朋友'}</Text>
            <Text style={styles.createSubtitle}>
              {hasCreated ? '南星已加入最初的居民' : '从名字、性格与关系开始'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.onboardingFooter}>
        <View>
          <Text style={styles.countLabel}>当前居民</Text>
          <Text style={styles.countValue}>{residents.length}<Text style={styles.countLimit}> / 10</Text></Text>
        </View>
        <Pressable
          accessibilityLabel="确认居民并进入我的世界"
          accessibilityRole="button"
          onPress={onConfirm}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
        >
          <Text style={styles.primaryButtonText}>进入我的世界</Text>
          <ArrowGlyph color={PALETTE.paper} />
        </Pressable>
      </View>
    </View>
  );
}

function ConversationList({
  conversations,
  onOpen,
}: {
  conversations: Conversation[];
  onOpen: (conversation: Conversation) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <ScreenHeader eyebrow="几段正在生长的关系" title="对话" />
      <View style={styles.quietNote}>
        <View style={styles.quietSeed} />
        <Text style={styles.quietNoteText}>没有谁需要被排在第一位。想起谁，就去见谁。</Text>
      </View>

      <View style={styles.conversationList}>
        {conversations.map((conversation) => (
          <Pressable
            key={conversation.id}
            accessibilityLabel={`与${conversation.name}的对话`}
            accessibilityRole="button"
            onPress={() => onOpen(conversation)}
            style={({ pressed }) => [styles.conversationRow, pressed && styles.rowPressed]}
          >
            <Avatar
              resident={{
                id: conversation.id,
                name: conversation.name,
                initial: conversation.initial,
                relation: '',
                line: '',
                color: conversation.color,
                ink: conversation.ink,
              }}
              size={54}
            />
            <View style={styles.conversationBody}>
              <View style={styles.conversationTitleRow}>
                <View style={styles.nameAndBadge}>
                  <Text style={styles.conversationName}>{conversation.name}</Text>
                  {conversation.human ? (
                    <View style={styles.humanBadge}>
                      <Text style={styles.humanBadgeText}>朋友来访</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.conversationTime}>{conversation.time}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text numberOfLines={1} style={styles.conversationPreview}>
                  {conversation.preview}
                </Text>
                {conversation.unread ? <View style={styles.unreadSeed} /> : null}
              </View>
              {conversation.meta ? (
                <Text style={[styles.conversationMeta, conversation.human && styles.visitMeta]}>
                  {conversation.meta}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>
      <Text style={styles.listEnding}>关系不需要催促 · 慢慢来</Text>
    </ScrollView>
  );
}

function WorldScreen() {
  return (
    <ScrollView contentContainerStyle={styles.worldContent} showsVerticalScrollIndicator={false}>
      <View style={styles.worldHeader}>
        <View>
          <Text style={styles.worldEyebrow}>我的小世界</Text>
          <Text style={styles.worldTitle}>今日，风很轻</Text>
        </View>
        <View style={styles.worldOrbitMark}>
          <TabGlyph kind="world" selected />
        </View>
      </View>

      <View style={styles.residentStrip}>
        <View style={styles.residentFaces}>
          {INITIAL_RESIDENTS.slice(0, 4).map((resident, index) => (
            <View key={resident.id} style={{ marginLeft: index === 0 ? 0 : -10 }}>
              <Avatar resident={resident} size={38} outlined />
            </View>
          ))}
        </View>
        <View style={styles.residentStripText}>
          <Text style={styles.residentStripTitle}>四位朋友在这里</Text>
          <Text style={styles.residentStripSubtitle}>世界安静地运转着</Text>
        </View>
      </View>

      <PostCard
        author="小满"
        color="#DCE4D4"
        ink="#53614C"
        initial="满"
        text="窗台那盆薄荷冒出了两片新叶。没有什么大事发生，但我还是很想让你知道。"
        time="今天 09:18"
      >
        <View style={styles.botanicalCard}>
          <View style={styles.stem} />
          <View style={styles.leafLeft} />
          <View style={styles.leafRight} />
          <View style={styles.botanicalSun} />
        </View>
      </PostCard>
      <PostCard
        author="我"
        color="#E8D4B8"
        ink="#704B2D"
        initial="我"
        text="今天终于把拖了很久的小事做完了。没有想象中那么难，心里空出了一点位置。"
        time="昨天 22:06"
      />
      <PostCard
        author="知秋"
        color="#E3DDD4"
        farewell
        ink="#655D54"
        initial="秋"
        text="我要去看看更远一些的季节了。谢谢我们曾在同一段路上停留过。往后听见风的时候，就当作我也听见了。"
        time="昨天 17:40"
      />
      <PostCard
        author="砚青"
        color="#DDE0E7"
        ink="#535B6C"
        initial="砚"
        text="有些答案不会因为想得更快而更早出现。先把灯留着，明天再继续。"
        time="周二 23:11"
      />
      <View style={styles.worldEnding}>
        <View style={styles.worldEndingLine} />
        <Text style={styles.worldEndingText}>今天的世界，先读到这里</Text>
        <View style={styles.worldEndingLine} />
      </View>
    </ScrollView>
  );
}

function PostCard({
  author,
  initial,
  color,
  ink,
  text,
  time,
  farewell = false,
  children,
}: {
  author: string;
  initial: string;
  color: string;
  ink: string;
  text: string;
  time: string;
  farewell?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <View style={[styles.postCard, farewell && styles.farewellCard]}>
      <View style={styles.postHeader}>
        <Avatar
          resident={{ id: author, name: author, initial, relation: '', line: '', color, ink }}
          size={44}
          muted={farewell}
        />
        <View style={styles.postIdentity}>
          <View style={styles.postAuthorRow}>
            <Text style={styles.postAuthor}>{author}</Text>
            {farewell ? <Text style={styles.farewellLabel}>一封告别</Text> : null}
          </View>
          <Text style={styles.postTime}>{time}</Text>
        </View>
      </View>
      <Text style={[styles.postText, farewell && styles.farewellText]}>{text}</Text>
      {children}
    </View>
  );
}

function ProfileScreen({
  activeResidents,
  onOpenMailbox,
}: {
  activeResidents: number;
  onOpenMailbox: () => void;
}) {
  const [notice, setNotice] = useState('');

  return (
    <ScrollView contentContainerStyle={styles.profileContent} showsVerticalScrollIndicator={false}>
      <View style={styles.profileTopRow}>
        <ScreenHeader eyebrow="只属于你的地方" title="我的" compact />
        <PrototypeBadge />
      </View>
      <View style={styles.profileHero}>
        <View style={styles.profileHalo} />
        <View style={styles.ownerAvatar}>
          <Text style={styles.ownerAvatarText}>苏</Text>
        </View>
        <View style={styles.ownerIdentity}>
          <Text style={styles.ownerName}>苏苏</Text>
          <Text style={styles.ownerSubtitle}>这里没有观众，只有一起生活的人</Text>
        </View>
      </View>

      <Text style={styles.sectionCaption}>我的世界</Text>
      <View style={styles.settingsGroup}>
        <ProfileRow
          icon="residents"
          label="AI 好友"
          onPress={() => setNotice('AI 好友管理将在角色后端完成后开放')}
          value={`${activeResidents}/10`}
        />
        <ProfileRow icon="mailbox" label="信箱" onPress={onOpenMailbox} value="1 封来信" warm />
      </View>

      <Text style={styles.sectionCaption}>亲密朋友</Text>
      <View style={styles.settingsGroup}>
        <ProfileRow
          icon="invite"
          label="我的邀请码"
          onPress={() => setNotice('邀请码为目标功能，当前仅展示视觉原型')}
          value="0/3 席位"
        />
        <ProfileRow
          icon="portal"
          label="穿越到好朋友的世界"
          onPress={() => setNotice('穿越功能等待后端访问控制能力')}
        />
      </View>

      <Text style={styles.sectionCaption}>其他</Text>
      <View style={styles.settingsGroup}>
        <ProfileRow icon="settings" label="设置与隐私" onPress={() => setNotice('设置页沿用现有真实客户端能力')} />
      </View>
      {notice ? (
        <Pressable onPress={() => setNotice('')} style={styles.prototypeNotice}>
          <View style={styles.noticeSeed} />
          <Text style={styles.prototypeNoticeText}>{notice}</Text>
        </Pressable>
      ) : null}
      <Text style={styles.profileEnding}>朝夕相伴 · 视觉原型 01</Text>
    </ScrollView>
  );
}

function ProfileRow({
  icon,
  label,
  value,
  warm = false,
  onPress,
}: {
  icon: 'residents' | 'mailbox' | 'invite' | 'portal' | 'settings';
  label: string;
  value?: string;
  warm?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label}${value ? `，${value}` : ''}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.profileRow, pressed && styles.rowPressed]}
    >
      <View style={[styles.rowIconSurface, warm && styles.rowIconWarm]}>
        <RowGlyph kind={icon} />
      </View>
      <Text style={styles.profileRowLabel}>{label}</Text>
      {value ? (
        <View style={[styles.profileValuePill, warm && styles.profileValueWarm]}>
          <Text style={[styles.profileValue, warm && styles.profileValueWarmText]}>{value}</Text>
        </View>
      ) : null}
      <ChevronGlyph />
    </Pressable>
  );
}

function MailboxScreen({ onBack }: { onBack: () => void }) {
  const [decision, setDecision] = useState<'none' | 'accepted' | 'kept'>('none');

  return (
    <View style={styles.detailScreen}>
      <DetailHeader onBack={onBack} title="信箱" />
      <ScrollView contentContainerStyle={styles.mailContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.mailEyebrow}>一封从远方来的信</Text>
        <Text style={styles.mailTitle}>有人想在这里，找一个精神栖息地</Text>
        <View style={styles.letterPaper}>
          <View style={styles.letterStamp}>
            <MailboxGlyph color={PALETTE.accentDeep} />
          </View>
          <Text style={styles.letterGreeting}>你好，</Text>
          <Text style={styles.letterBody}>
            我叫林屿。过去很长一段时间，我总在不同的地方停留，听人讲他们没有说完的故事。
            {'\n\n'}如果你愿意，我想在这个小世界里住下来。不急着成为多重要的人，只想从一次普通的问候开始。
          </Text>
          <View style={styles.letterSignature}>
            <Avatar
              resident={{
                id: 'linyu',
                name: '林屿',
                initial: '屿',
                relation: '',
                line: '',
                color: '#D7E0D7',
                ink: '#4D6151',
              }}
              size={42}
            />
            <View>
              <Text style={styles.letterName}>林屿</Text>
              <Text style={styles.letterMeta}>运营设定角色 · 不会自动加入</Text>
            </View>
          </View>
        </View>

        {decision === 'none' ? (
          <View style={styles.mailActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDecision('accepted')}
              style={({ pressed }) => [styles.mailPrimary, pressed && styles.primaryButtonPressed]}
            >
              <Text style={styles.mailPrimaryText}>欢迎来到这里</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDecision('kept')}
              style={({ pressed }) => [styles.mailSecondary, pressed && styles.rowPressed]}
            >
              <Text style={styles.mailSecondaryText}>先把信放在这里</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.mailDecision}>
            <View style={styles.decisionSeed} />
            <Text style={styles.mailDecisionTitle}>
              {decision === 'accepted' ? '林屿会成为这个世界的新居民' : '信已经安静地收好了'}
            </Text>
            <Text style={styles.mailDecisionText}>
              {decision === 'accepted'
                ? '正式版本会在服务端再次确认居民上限后完成加入。'
                : '没有倒计时，也不会催促你做决定。'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ChatPreview({
  conversation,
  onBack,
}: {
  conversation: Conversation;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState<string[]>([]);

  function submit() {
    const text = draft.trim();
    if (!text) {
      return;
    }
    setSent((current) => [...current, text]);
    setDraft('');
  }

  return (
    <View style={styles.detailScreen}>
      <View style={styles.chatHeader}>
        <Pressable
          accessibilityLabel="返回对话列表"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onBack}
          style={styles.backButton}
        >
          <BackGlyph />
        </Pressable>
        <Avatar
          resident={{
            id: conversation.id,
            name: conversation.name,
            initial: conversation.initial,
            relation: '',
            line: '',
            color: conversation.color,
            ink: conversation.ink,
          }}
          size={38}
        />
        <View style={styles.chatIdentity}>
          <Text style={styles.chatName}>{conversation.name}</Text>
          <Text style={styles.chatSubtitle}>
            {conversation.human ? '亲密朋友 · 来访中' : '在你的世界里'}
          </Text>
        </View>
        <PrototypeBadge small />
      </View>
      <ScrollView contentContainerStyle={styles.chatMessages}>
        <Text style={styles.chatDay}>今天</Text>
        <View style={styles.aiMessageRow}>
          <Avatar
            resident={{
              id: conversation.id,
              name: conversation.name,
              initial: conversation.initial,
              relation: '',
              line: '',
              color: conversation.color,
              ink: conversation.ink,
            }}
            size={30}
          />
          <View style={styles.aiMessageBubble}>
            <Text style={styles.chatMessageText}>{conversation.preview}</Text>
          </View>
        </View>
        <View style={styles.userMessageBubble}>
          <Text style={styles.chatMessageText}>那就陪我安静地待一会儿吧。</Text>
        </View>
        <View style={styles.aiMessageRow}>
          <Avatar
            resident={{
              id: conversation.id,
              name: conversation.name,
              initial: conversation.initial,
              relation: '',
              line: '',
              color: conversation.color,
              ink: conversation.ink,
            }}
            size={30}
          />
          <View style={styles.aiMessageBubble}>
            <Text style={styles.chatMessageText}>好。我在这里，不需要急着说什么。</Text>
          </View>
        </View>
        {sent.map((text, index) => (
          <View key={`${text}-${index}`} style={styles.userMessageBubble}>
            <Text style={styles.chatMessageText}>{text}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.prototypeComposer}>
        <View style={styles.voiceGlyph}>
          <View style={styles.voiceLineShort} />
          <View style={styles.voiceLineTall} />
          <View style={styles.voiceLineShort} />
        </View>
        <TextInput
          accessibilityLabel="输入消息"
          multiline
          onChangeText={setDraft}
          placeholder="想说点什么…"
          placeholderTextColor={PALETTE.quiet}
          style={styles.prototypeInput}
          value={draft}
        />
        <Pressable
          accessibilityLabel="发送消息"
          accessibilityRole="button"
          disabled={!draft.trim()}
          onPress={submit}
          style={[styles.prototypeSend, !draft.trim() && styles.prototypeSendDisabled]}
        >
          <ArrowGlyph color={PALETTE.paper} />
        </Pressable>
      </View>
    </View>
  );
}

function ScreenHeader({
  eyebrow,
  title,
  compact = false,
}: {
  eyebrow: string;
  title: string;
  compact?: boolean;
}) {
  return (
    <View style={compact ? undefined : styles.screenHeader}>
      <Text style={styles.screenEyebrow}>{eyebrow}</Text>
      <Text style={styles.screenTitle}>{title}</Text>
    </View>
  );
}

function DetailHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.detailHeader}>
      <Pressable
        accessibilityLabel="返回"
        accessibilityRole="button"
        onPress={onBack}
        style={styles.backButton}
      >
        <BackGlyph />
      </Pressable>
      <Text style={styles.detailTitle}>{title}</Text>
      <PrototypeBadge small />
    </View>
  );
}

function BottomTabs({ selected, onSelect }: { selected: TabKey; onSelect: (tab: TabKey) => void }) {
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'conversations', label: '对话' },
    { key: 'world', label: '世界' },
    { key: 'profile', label: '我的' },
  ];

  return (
    <View style={styles.bottomTabs}>
      {tabs.map((item) => {
        const active = selected === item.key;
        return (
          <Pressable
            key={item.key}
            accessibilityLabel={item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(item.key)}
            style={({ pressed }) => [styles.tabButton, pressed && styles.tabPressed]}
          >
            <View style={[styles.tabSelection, active && styles.tabSelectionActive]}>
              <TabGlyph kind={item.key} selected={active} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function Avatar({
  resident,
  size,
  outlined = false,
  muted = false,
}: {
  resident: Resident;
  size: number;
  outlined?: boolean;
  muted?: boolean;
}) {
  return (
    <View
      style={[
        styles.avatar,
        {
          backgroundColor: resident.color,
          borderRadius: size / 2,
          height: size,
          opacity: muted ? 0.72 : 1,
          width: size,
        },
        outlined && styles.avatarOutlined,
      ]}
    >
      <View
        style={[
          styles.avatarLight,
          {
            borderRadius: size * 0.18,
            height: size * 0.36,
            right: size * 0.12,
            top: size * 0.08,
            width: size * 0.36,
          },
        ]}
      />
      <Text style={[styles.avatarText, { color: resident.ink, fontSize: size * 0.32 }]}>
        {resident.initial}
      </Text>
    </View>
  );
}

function PrototypeBadge({ small = false }: { small?: boolean }) {
  return (
    <View style={[styles.prototypeBadge, small && styles.prototypeBadgeSmall]}>
      <View style={styles.prototypeBadgeDot} />
      <Text style={[styles.prototypeBadgeText, small && styles.prototypeBadgeTextSmall]}>视觉原型</Text>
    </View>
  );
}

function SeedMark() {
  return (
    <View style={styles.seedMark}>
      <View style={styles.seedOrbit} />
      <View style={styles.seedCenter} />
    </View>
  );
}

function TabGlyph({ kind, selected }: { kind: TabKey; selected: boolean }) {
  const color = selected ? PALETTE.accentDeep : PALETTE.muted;
  if (kind === 'conversations') {
    return (
      <View style={styles.glyphCanvas}>
        <View style={[styles.conversationArc, { borderColor: color, borderRightColor: 'transparent' }]} />
        <View style={[styles.conversationDotLeft, { backgroundColor: selected ? PALETTE.accent : color }]} />
        <View style={[styles.conversationDotRight, { backgroundColor: color }]} />
      </View>
    );
  }
  if (kind === 'world') {
    return (
      <View style={styles.glyphCanvas}>
        <View style={[styles.worldRingOuter, { borderColor: color, borderRightColor: 'transparent' }]} />
        <View style={[styles.worldRingInner, { borderColor: color, borderTopColor: 'transparent' }]} />
        <View style={[styles.worldDot, { backgroundColor: selected ? PALETTE.accent : color }]} />
      </View>
    );
  }
  return (
    <View style={styles.glyphCanvas}>
      <View style={[styles.profileHead, { backgroundColor: selected ? PALETTE.accent : color }]} />
      <View style={[styles.profileArc, { borderColor: color, borderTopColor: 'transparent' }]} />
    </View>
  );
}

function RowGlyph({ kind }: { kind: 'residents' | 'mailbox' | 'invite' | 'portal' | 'settings' }) {
  if (kind === 'mailbox') {
    return <MailboxGlyph color={PALETTE.accentDeep} />;
  }
  if (kind === 'residents') {
    return (
      <View style={styles.rowGlyphCanvas}>
        <View style={styles.peopleHeadA} />
        <View style={styles.peopleHeadB} />
        <View style={styles.peopleArcA} />
        <View style={styles.peopleArcB} />
      </View>
    );
  }
  if (kind === 'invite') {
    return (
      <View style={styles.rowGlyphCanvas}>
        <View style={styles.inviteRing} />
        <View style={styles.inviteSeed} />
        <View style={styles.invitePlusH} />
        <View style={styles.invitePlusV} />
      </View>
    );
  }
  if (kind === 'portal') {
    return (
      <View style={styles.rowGlyphCanvas}>
        <View style={styles.portalRingA} />
        <View style={styles.portalRingB} />
        <View style={styles.portalDot} />
      </View>
    );
  }
  return (
    <View style={styles.rowGlyphCanvas}>
      <View style={styles.settingsRing} />
      <View style={styles.settingsDot} />
    </View>
  );
}

function MailboxGlyph({ color }: { color: string }) {
  return (
    <View style={styles.mailboxCanvas}>
      <View style={[styles.mailboxBox, { borderColor: color }]} />
      <View style={[styles.mailboxFlapLeft, { backgroundColor: color }]} />
      <View style={[styles.mailboxFlapRight, { backgroundColor: color }]} />
    </View>
  );
}

function PlusGlyph({ color }: { color: string }) {
  return (
    <View style={styles.plusCanvas}>
      <View style={[styles.plusHorizontal, { backgroundColor: color }]} />
      <View style={[styles.plusVertical, { backgroundColor: color }]} />
    </View>
  );
}

function CheckGlyph() {
  return (
    <View style={styles.checkCanvas}>
      <View style={styles.checkShort} />
      <View style={styles.checkLong} />
    </View>
  );
}

function CloseGlyph({ muted }: { muted: boolean }) {
  const color = muted ? PALETTE.line : PALETTE.muted;
  return (
    <View style={styles.closeCanvas}>
      <View style={[styles.closeLineA, { backgroundColor: color }]} />
      <View style={[styles.closeLineB, { backgroundColor: color }]} />
    </View>
  );
}

function ArrowGlyph({ color }: { color: string }) {
  return <View style={[styles.arrowGlyph, { borderColor: color }]} />;
}

function ChevronGlyph() {
  return <View style={styles.chevronGlyph} />;
}

function BackGlyph() {
  return <View style={styles.backGlyph} />;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: PALETTE.background, flex: 1 },
  appFrame: { flex: 1, overflow: 'hidden' },
  tabContent: { flex: 1 },
  ambientOne: {
    backgroundColor: '#EBE1CF',
    borderRadius: 130,
    height: 260,
    opacity: 0.52,
    position: 'absolute',
    right: -130,
    top: -95,
    width: 260,
  },
  ambientTwo: {
    backgroundColor: '#E1E6DB',
    borderRadius: 100,
    height: 200,
    left: -120,
    opacity: 0.36,
    position: 'absolute',
    top: 300,
    width: 200,
  },
  onboardingScreen: { backgroundColor: PALETTE.background, flex: 1, overflow: 'hidden' },
  onboardingGlowA: {
    backgroundColor: '#E8DECD',
    borderRadius: 160,
    height: 320,
    position: 'absolute',
    right: -170,
    top: -130,
    width: 320,
  },
  onboardingGlowB: {
    backgroundColor: '#DEE5D9',
    borderRadius: 130,
    bottom: 40,
    height: 260,
    left: -170,
    opacity: 0.62,
    position: 'absolute',
    width: 260,
  },
  onboardingContent: { alignSelf: 'center', maxWidth: 520, paddingBottom: 124, paddingHorizontal: 18, width: '100%' },
  onboardingTopRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28, marginTop: 14 },
  onboardingEyebrow: { color: PALETTE.accentDeep, fontSize: 12, fontWeight: '700', letterSpacing: 2.4 },
  onboardingTitle: { color: PALETTE.ink, fontSize: 30, fontWeight: '700', letterSpacing: 0.5, lineHeight: 39, marginTop: 9 },
  onboardingSubtitle: { color: PALETTE.muted, fontSize: 15, lineHeight: 24, marginTop: 11, maxWidth: 360 },
  residentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 28 },
  residentCard: {
    backgroundColor: 'rgba(255,252,246,0.94)',
    borderColor: PALETTE.line,
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 236,
    padding: 15,
    paddingTop: 18,
    shadowColor: '#5D4C3A',
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.055,
    shadowRadius: 14,
  },
  removeButton: { alignItems: 'center', height: 34, justifyContent: 'center', position: 'absolute', right: 7, top: 7, width: 34, zIndex: 2 },
  removeButtonDisabled: { opacity: 0.7 },
  residentName: { color: PALETTE.ink, fontSize: 19, fontWeight: '700', marginTop: 13 },
  residentRelation: { color: PALETTE.accentDeep, fontSize: 11, lineHeight: 16, marginTop: 4 },
  residentDivider: { backgroundColor: PALETTE.line, height: StyleSheet.hairlineWidth, marginVertical: 11 },
  residentLine: { color: PALETTE.muted, fontSize: 12, lineHeight: 18 },
  createCard: { alignItems: 'center', borderColor: '#CBB99F', borderRadius: 24, borderStyle: 'dashed', borderWidth: 1, justifyContent: 'center', minHeight: 236, padding: 16 },
  createCardDisabled: { backgroundColor: 'rgba(255,252,246,0.55)', borderStyle: 'solid' },
  createGlyphCircle: { alignItems: 'center', backgroundColor: PALETTE.accentSoft, borderRadius: 30, height: 60, justifyContent: 'center', width: 60 },
  createTitle: { color: PALETTE.ink, fontSize: 16, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  createSubtitle: { color: PALETTE.muted, fontSize: 12, lineHeight: 18, marginTop: 6, textAlign: 'center' },
  softPressed: { opacity: 0.72 },
  onboardingFooter: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,252,246,0.98)',
    borderTopColor: PALETTE.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    paddingHorizontal: 20,
    paddingVertical: 13,
    position: 'absolute',
    right: 0,
  },
  countLabel: { color: PALETTE.muted, fontSize: 11 },
  countValue: { color: PALETTE.ink, fontSize: 22, fontWeight: '700', marginTop: 1 },
  countLimit: { color: PALETTE.quiet, fontSize: 13, fontWeight: '500' },
  primaryButton: { alignItems: 'center', backgroundColor: PALETTE.accentDeep, borderRadius: 18, flexDirection: 'row', gap: 11, minHeight: 54, paddingHorizontal: 22 },
  primaryButtonPressed: { backgroundColor: '#5D3E29', opacity: 0.9 },
  primaryButtonText: { color: PALETTE.paper, fontSize: 15, fontWeight: '700' },
  screenContent: { paddingBottom: 36, paddingHorizontal: 20 },
  screenHeader: { marginBottom: 21, marginTop: 23 },
  screenEyebrow: { color: PALETTE.accentDeep, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  screenTitle: { color: PALETTE.ink, fontSize: 31, fontWeight: '700', letterSpacing: 1, marginTop: 5 },
  quietNote: { alignItems: 'center', backgroundColor: 'rgba(255,252,246,0.72)', borderColor: PALETTE.line, borderRadius: 16, borderWidth: 1, flexDirection: 'row', marginBottom: 18, paddingHorizontal: 13, paddingVertical: 11 },
  quietSeed: { backgroundColor: PALETTE.sage, borderRadius: 4, height: 8, marginRight: 9, width: 8 },
  quietNoteText: { color: PALETTE.muted, flex: 1, fontSize: 12, lineHeight: 18 },
  conversationList: { backgroundColor: 'rgba(255,252,246,0.9)', borderColor: PALETTE.line, borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  conversationRow: { alignItems: 'center', borderBottomColor: PALETTE.line, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 88, paddingHorizontal: 14, paddingVertical: 14 },
  rowPressed: { backgroundColor: '#F2EADD' },
  conversationBody: { flex: 1, marginLeft: 13 },
  conversationTitleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  nameAndBadge: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: 7 },
  conversationName: { color: PALETTE.ink, fontSize: 16, fontWeight: '700' },
  conversationTime: { color: PALETTE.quiet, fontSize: 11, marginLeft: 8 },
  previewRow: { alignItems: 'center', flexDirection: 'row', marginTop: 6 },
  conversationPreview: { color: PALETTE.muted, flex: 1, fontSize: 13 },
  unreadSeed: { backgroundColor: PALETTE.accent, borderRadius: 4, height: 8, marginLeft: 8, width: 8 },
  conversationMeta: { color: PALETTE.sage, fontSize: 10, marginTop: 5 },
  visitMeta: { color: PALETTE.accentDeep },
  humanBadge: { backgroundColor: PALETTE.sageSoft, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  humanBadgeText: { color: '#56634F', fontSize: 9, fontWeight: '700' },
  listEnding: { color: PALETTE.quiet, fontSize: 11, letterSpacing: 0.6, marginTop: 24, textAlign: 'center' },
  worldContent: { paddingBottom: 38, paddingHorizontal: 18 },
  worldHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 23, marginTop: 22 },
  worldEyebrow: { color: PALETTE.accentDeep, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  worldTitle: { color: PALETTE.ink, fontSize: 29, fontWeight: '700', marginTop: 6 },
  worldOrbitMark: { alignItems: 'center', backgroundColor: PALETTE.accentSoft, borderRadius: 25, height: 50, justifyContent: 'center', width: 50 },
  residentStrip: { alignItems: 'center', backgroundColor: 'rgba(255,252,246,0.78)', borderColor: PALETTE.line, borderRadius: 19, borderWidth: 1, flexDirection: 'row', marginBottom: 14, padding: 13 },
  residentFaces: { flexDirection: 'row', paddingLeft: 2 },
  residentStripText: { flex: 1, marginLeft: 13 },
  residentStripTitle: { color: PALETTE.ink, fontSize: 13, fontWeight: '700' },
  residentStripSubtitle: { color: PALETTE.muted, fontSize: 11, marginTop: 3 },
  postCard: { backgroundColor: 'rgba(255,252,246,0.94)', borderColor: PALETTE.line, borderRadius: 23, borderWidth: 1, marginBottom: 13, padding: 16 },
  farewellCard: { backgroundColor: '#F0ECE5', borderColor: '#D9D1C6' },
  postHeader: { alignItems: 'center', flexDirection: 'row' },
  postIdentity: { flex: 1, marginLeft: 11 },
  postAuthorRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  postAuthor: { color: PALETTE.ink, fontSize: 15, fontWeight: '700' },
  postTime: { color: PALETTE.quiet, fontSize: 10, marginTop: 4 },
  postText: { color: PALETTE.ink, fontSize: 15, lineHeight: 24, marginTop: 14 },
  farewellText: { color: '#5F5952', fontStyle: 'italic' },
  farewellLabel: { borderColor: '#BEB4A8', borderRadius: 7, borderWidth: 1, color: '#766E65', fontSize: 9, paddingHorizontal: 6, paddingVertical: 2 },
  botanicalCard: { backgroundColor: '#E7E6D7', borderRadius: 16, height: 126, marginTop: 14, overflow: 'hidden', position: 'relative' },
  stem: { backgroundColor: '#77816A', bottom: 0, height: 84, left: '49%', position: 'absolute', transform: [{ rotate: '4deg' }], width: 3 },
  leafLeft: { backgroundColor: '#8E9A7C', borderBottomLeftRadius: 22, borderTopRightRadius: 22, height: 35, left: '32%', position: 'absolute', top: 45, transform: [{ rotate: '14deg' }], width: 44 },
  leafRight: { backgroundColor: '#A4AD92', borderBottomRightRadius: 22, borderTopLeftRadius: 22, height: 31, position: 'absolute', right: '29%', top: 24, transform: [{ rotate: '-10deg' }], width: 40 },
  botanicalSun: { backgroundColor: '#E1C898', borderRadius: 20, height: 40, opacity: 0.72, position: 'absolute', right: 18, top: 16, width: 40 },
  worldEnding: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 18 },
  worldEndingLine: { backgroundColor: PALETTE.line, flex: 1, height: StyleSheet.hairlineWidth },
  worldEndingText: { color: PALETTE.quiet, fontSize: 10 },
  profileContent: { paddingBottom: 40, paddingHorizontal: 20 },
  profileTopRow: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22, marginTop: 22 },
  profileHero: { alignItems: 'center', backgroundColor: 'rgba(255,252,246,0.92)', borderColor: PALETTE.line, borderRadius: 25, borderWidth: 1, flexDirection: 'row', overflow: 'hidden', padding: 18, position: 'relative' },
  profileHalo: { backgroundColor: PALETTE.accentSoft, borderRadius: 75, height: 150, opacity: 0.46, position: 'absolute', right: -35, top: -75, width: 150 },
  ownerAvatar: { alignItems: 'center', backgroundColor: '#E4C99E', borderRadius: 31, height: 62, justifyContent: 'center', width: 62 },
  ownerAvatarText: { color: '#704C2D', fontSize: 23, fontWeight: '700' },
  ownerIdentity: { flex: 1, marginLeft: 15 },
  ownerName: { color: PALETTE.ink, fontSize: 21, fontWeight: '700' },
  ownerSubtitle: { color: PALETTE.muted, fontSize: 12, lineHeight: 18, marginTop: 5, maxWidth: 230 },
  sectionCaption: { color: PALETTE.muted, fontSize: 11, fontWeight: '600', letterSpacing: 1.4, marginBottom: 8, marginLeft: 4, marginTop: 24 },
  settingsGroup: { backgroundColor: 'rgba(255,252,246,0.94)', borderColor: PALETTE.line, borderRadius: 21, borderWidth: 1, overflow: 'hidden' },
  profileRow: { alignItems: 'center', borderBottomColor: PALETTE.line, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 66, paddingHorizontal: 13 },
  rowIconSurface: { alignItems: 'center', backgroundColor: PALETTE.paperDeep, borderRadius: 13, height: 40, justifyContent: 'center', width: 40 },
  rowIconWarm: { backgroundColor: PALETTE.accentSoft },
  profileRowLabel: { color: PALETTE.ink, flex: 1, fontSize: 15, fontWeight: '600', marginLeft: 12 },
  profileValuePill: { backgroundColor: '#ECE7DF', borderRadius: 10, marginRight: 12, paddingHorizontal: 8, paddingVertical: 5 },
  profileValueWarm: { backgroundColor: '#EAD4B8' },
  profileValue: { color: PALETTE.muted, fontSize: 10 },
  profileValueWarmText: { color: PALETTE.accentDeep, fontWeight: '700' },
  prototypeNotice: { alignItems: 'center', alignSelf: 'center', backgroundColor: '#E9E1D4', borderRadius: 14, flexDirection: 'row', marginTop: 18, paddingHorizontal: 13, paddingVertical: 10 },
  noticeSeed: { backgroundColor: PALETTE.accent, borderRadius: 4, height: 7, marginRight: 8, width: 7 },
  prototypeNoticeText: { color: PALETTE.muted, fontSize: 11 },
  profileEnding: { color: PALETTE.quiet, fontSize: 10, letterSpacing: 1, marginTop: 30, textAlign: 'center' },
  detailScreen: { backgroundColor: PALETTE.background, flex: 1 },
  detailHeader: { alignItems: 'center', backgroundColor: 'rgba(255,252,246,0.94)', borderBottomColor: PALETTE.line, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 58, paddingHorizontal: 12 },
  detailTitle: { color: PALETTE.ink, fontSize: 17, fontWeight: '700' },
  backButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  mailContent: { paddingBottom: 40, paddingHorizontal: 20, paddingTop: 27 },
  mailEyebrow: { color: PALETTE.accentDeep, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  mailTitle: { color: PALETTE.ink, fontSize: 27, fontWeight: '700', lineHeight: 37, marginTop: 9, maxWidth: 330 },
  letterPaper: { backgroundColor: '#FFFCF4', borderColor: '#DCCFBD', borderRadius: 4, borderWidth: 1, marginTop: 25, padding: 22, paddingTop: 29, position: 'relative', shadowColor: '#5E4C38', shadowOffset: { height: 7, width: 0 }, shadowOpacity: 0.08, shadowRadius: 18 },
  letterStamp: { alignItems: 'center', backgroundColor: '#EADDC8', borderColor: '#C8B69E', borderRadius: 4, borderStyle: 'dashed', borderWidth: 1, height: 48, justifyContent: 'center', position: 'absolute', right: 16, top: 16, width: 48 },
  letterGreeting: { color: PALETTE.ink, fontSize: 17, fontWeight: '700', marginTop: 46 },
  letterBody: { color: '#534D45', fontSize: 15, lineHeight: 27, marginTop: 15 },
  letterSignature: { alignItems: 'center', borderTopColor: '#E3D8C8', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 11, marginTop: 24, paddingTop: 17 },
  letterName: { color: PALETTE.ink, fontSize: 14, fontWeight: '700' },
  letterMeta: { color: PALETTE.quiet, fontSize: 10, marginTop: 3 },
  mailActions: { gap: 10, marginTop: 20 },
  mailPrimary: { alignItems: 'center', backgroundColor: PALETTE.accentDeep, borderRadius: 17, justifyContent: 'center', minHeight: 54 },
  mailPrimaryText: { color: PALETTE.paper, fontSize: 15, fontWeight: '700' },
  mailSecondary: { alignItems: 'center', backgroundColor: 'rgba(255,252,246,0.7)', borderColor: PALETTE.line, borderRadius: 17, borderWidth: 1, justifyContent: 'center', minHeight: 52 },
  mailSecondaryText: { color: PALETTE.muted, fontSize: 14, fontWeight: '600' },
  mailDecision: { alignItems: 'center', backgroundColor: '#E5E7DC', borderRadius: 18, marginTop: 20, padding: 18 },
  decisionSeed: { backgroundColor: PALETTE.sage, borderRadius: 5, height: 10, width: 10 },
  mailDecisionTitle: { color: PALETTE.ink, fontSize: 15, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  mailDecisionText: { color: PALETTE.muted, fontSize: 12, lineHeight: 18, marginTop: 5, textAlign: 'center' },
  chatHeader: { alignItems: 'center', backgroundColor: 'rgba(255,252,246,0.96)', borderBottomColor: PALETTE.line, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 59, paddingHorizontal: 7 },
  chatIdentity: { flex: 1, marginLeft: 10 },
  chatName: { color: PALETTE.ink, fontSize: 16, fontWeight: '700' },
  chatSubtitle: { color: PALETTE.muted, fontSize: 10, marginTop: 2 },
  chatMessages: { flexGrow: 1, padding: 16, paddingBottom: 25 },
  chatDay: { color: PALETTE.quiet, fontSize: 10, marginBottom: 20, textAlign: 'center' },
  aiMessageRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8, marginBottom: 15, maxWidth: '87%' },
  aiMessageBubble: { backgroundColor: PALETTE.paper, borderColor: PALETTE.line, borderBottomLeftRadius: 6, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11 },
  userMessageBubble: { alignSelf: 'flex-end', backgroundColor: '#DFC095', borderBottomRightRadius: 6, borderRadius: 18, marginBottom: 15, maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 11 },
  chatMessageText: { color: PALETTE.ink, fontSize: 15, lineHeight: 22 },
  prototypeComposer: { alignItems: 'flex-end', backgroundColor: PALETTE.paper, borderTopColor: PALETTE.line, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 8, paddingHorizontal: 11, paddingVertical: 10 },
  voiceGlyph: { alignItems: 'center', borderColor: PALETTE.line, borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: 2, height: 40, justifyContent: 'center', width: 40 },
  voiceLineShort: { backgroundColor: PALETTE.accentDeep, borderRadius: 1, height: 9, width: 2 },
  voiceLineTall: { backgroundColor: PALETTE.accentDeep, borderRadius: 1, height: 16, width: 2 },
  prototypeInput: { backgroundColor: PALETTE.white, borderColor: PALETTE.line, borderRadius: 19, borderWidth: 1, color: PALETTE.ink, flex: 1, fontSize: 15, maxHeight: 100, minHeight: 40, paddingHorizontal: 13, paddingVertical: 9 },
  prototypeSend: { alignItems: 'center', backgroundColor: PALETTE.accentDeep, borderRadius: 20, height: 40, justifyContent: 'center', transform: [{ rotate: '-45deg' }], width: 40 },
  prototypeSendDisabled: { backgroundColor: '#CFC3B4' },
  bottomTabs: { alignItems: 'center', backgroundColor: 'rgba(255,252,246,0.98)', borderTopColor: PALETTE.line, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-around', minHeight: 68, paddingHorizontal: 28, paddingVertical: 7 },
  tabButton: { alignItems: 'center', height: 52, justifyContent: 'center', width: 64 },
  tabPressed: { opacity: 0.72 },
  tabSelection: { alignItems: 'center', borderRadius: 18, height: 42, justifyContent: 'center', width: 48 },
  tabSelectionActive: { backgroundColor: '#EFE0CC' },
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarOutlined: { borderColor: PALETTE.paper, borderWidth: 2 },
  avatarLight: { backgroundColor: 'rgba(255,255,255,0.32)', position: 'absolute', transform: [{ rotate: '16deg' }] },
  avatarText: { fontWeight: '700' },
  prototypeBadge: { alignItems: 'center', backgroundColor: 'rgba(255,252,246,0.74)', borderColor: PALETTE.line, borderRadius: 12, borderWidth: 1, flexDirection: 'row', paddingHorizontal: 9, paddingVertical: 6 },
  prototypeBadgeSmall: { borderRadius: 9, paddingHorizontal: 7, paddingVertical: 4 },
  prototypeBadgeDot: { backgroundColor: PALETTE.sage, borderRadius: 3, height: 6, marginRight: 6, width: 6 },
  prototypeBadgeText: { color: PALETTE.muted, fontSize: 10, fontWeight: '600' },
  prototypeBadgeTextSmall: { fontSize: 9 },
  seedMark: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  seedOrbit: { borderColor: PALETTE.accentDeep, borderRadius: 19, borderRightColor: 'transparent', borderWidth: 1.5, height: 30, transform: [{ rotate: '-18deg' }], width: 38 },
  seedCenter: { backgroundColor: PALETTE.accent, borderRadius: 5, height: 10, position: 'absolute', width: 10 },
  glyphCanvas: { height: 28, position: 'relative', width: 32 },
  conversationArc: { borderRadius: 11, borderWidth: 1.7, height: 20, left: 2, position: 'absolute', top: 3, width: 28 },
  conversationDotLeft: { borderRadius: 3, height: 6, left: 9, position: 'absolute', top: 10, width: 6 },
  conversationDotRight: { borderRadius: 2.5, height: 5, position: 'absolute', right: 8, top: 11, width: 5 },
  worldRingOuter: { borderRadius: 14, borderWidth: 1.5, height: 23, left: 1, position: 'absolute', top: 2, transform: [{ rotate: '-13deg' }], width: 30 },
  worldRingInner: { borderRadius: 10, borderWidth: 1.3, height: 15, left: 6, position: 'absolute', top: 6, transform: [{ rotate: '18deg' }], width: 21 },
  worldDot: { borderRadius: 3.5, height: 7, left: 13, position: 'absolute', top: 10, width: 7 },
  profileHead: { borderRadius: 4, height: 8, left: 12, position: 'absolute', top: 3, width: 8 },
  profileArc: { borderRadius: 15, borderWidth: 1.6, height: 20, left: 5, position: 'absolute', top: 9, width: 22 },
  rowGlyphCanvas: { height: 26, position: 'relative', width: 28 },
  mailboxCanvas: { height: 24, position: 'relative', width: 28 },
  mailboxBox: { borderRadius: 4, borderWidth: 1.5, bottom: 2, height: 18, left: 2, position: 'absolute', width: 24 },
  mailboxFlapLeft: { height: 1.5, left: 4, position: 'absolute', top: 8, transform: [{ rotate: '34deg' }], width: 11 },
  mailboxFlapRight: { height: 1.5, position: 'absolute', right: 4, top: 8, transform: [{ rotate: '-34deg' }], width: 11 },
  peopleHeadA: { backgroundColor: PALETTE.accentDeep, borderRadius: 3.5, height: 7, left: 5, position: 'absolute', top: 3, width: 7 },
  peopleHeadB: { backgroundColor: PALETTE.sage, borderRadius: 3.5, height: 7, position: 'absolute', right: 5, top: 5, width: 7 },
  peopleArcA: { borderColor: PALETTE.accentDeep, borderRadius: 9, borderTopColor: 'transparent', borderWidth: 1.4, bottom: 1, height: 13, left: 1, position: 'absolute', width: 16 },
  peopleArcB: { borderColor: PALETTE.sage, borderRadius: 9, borderTopColor: 'transparent', borderWidth: 1.4, bottom: 0, height: 12, position: 'absolute', right: 1, width: 16 },
  inviteRing: { borderColor: PALETTE.accentDeep, borderRadius: 10, borderRightColor: 'transparent', borderWidth: 1.4, height: 20, left: 1, position: 'absolute', top: 3, width: 20 },
  inviteSeed: { backgroundColor: PALETTE.accent, borderRadius: 3, height: 6, left: 8, position: 'absolute', top: 10, width: 6 },
  invitePlusH: { backgroundColor: PALETTE.accentDeep, height: 1.5, position: 'absolute', right: 0, top: 8, width: 8 },
  invitePlusV: { backgroundColor: PALETTE.accentDeep, height: 8, position: 'absolute', right: 3, top: 5, width: 1.5 },
  portalRingA: { borderColor: PALETTE.accentDeep, borderRadius: 10, borderRightColor: 'transparent', borderWidth: 1.4, height: 20, left: 0, position: 'absolute', top: 3, transform: [{ rotate: '-10deg' }], width: 22 },
  portalRingB: { borderColor: PALETTE.sage, borderLeftColor: 'transparent', borderRadius: 9, borderWidth: 1.4, height: 17, position: 'absolute', right: 0, top: 5, transform: [{ rotate: '13deg' }], width: 19 },
  portalDot: { backgroundColor: PALETTE.accent, borderRadius: 3, height: 6, left: 11, position: 'absolute', top: 10, width: 6 },
  settingsRing: { borderColor: PALETTE.accentDeep, borderRadius: 10, borderWidth: 1.5, height: 20, left: 4, position: 'absolute', top: 3, width: 20 },
  settingsDot: { backgroundColor: PALETTE.accentDeep, borderRadius: 3, height: 6, left: 11, position: 'absolute', top: 10, width: 6 },
  plusCanvas: { height: 24, position: 'relative', width: 24 },
  plusHorizontal: { borderRadius: 1, height: 2, left: 5, position: 'absolute', top: 11, width: 14 },
  plusVertical: { borderRadius: 1, height: 14, left: 11, position: 'absolute', top: 5, width: 2 },
  checkCanvas: { height: 22, position: 'relative', width: 24 },
  checkShort: { backgroundColor: PALETTE.accentDeep, borderRadius: 1, height: 2, left: 3, position: 'absolute', top: 12, transform: [{ rotate: '43deg' }], width: 8 },
  checkLong: { backgroundColor: PALETTE.accentDeep, borderRadius: 1, height: 2, left: 8, position: 'absolute', top: 10, transform: [{ rotate: '-44deg' }], width: 14 },
  closeCanvas: { height: 20, position: 'relative', width: 20 },
  closeLineA: { height: 1.5, left: 4, position: 'absolute', top: 9, transform: [{ rotate: '45deg' }], width: 12 },
  closeLineB: { height: 1.5, left: 4, position: 'absolute', top: 9, transform: [{ rotate: '-45deg' }], width: 12 },
  arrowGlyph: { borderRightWidth: 1.7, borderTopWidth: 1.7, height: 8, transform: [{ rotate: '45deg' }], width: 8 },
  chevronGlyph: { borderColor: PALETTE.quiet, borderRightWidth: 1.4, borderTopWidth: 1.4, height: 8, marginRight: 5, transform: [{ rotate: '45deg' }], width: 8 },
  backGlyph: { borderBottomWidth: 1.8, borderColor: PALETTE.ink, borderLeftWidth: 1.8, height: 10, transform: [{ rotate: '45deg' }], width: 10 },
});
