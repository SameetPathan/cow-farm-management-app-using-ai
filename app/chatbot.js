import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import LanguageSelector from "../components/LanguageSelector";
import { ANTHROPIC_API_KEY, ANTHROPIC_API_URL } from "../config/api";
import { useLanguage } from "../contexts/LanguageContext";

export default function ChatbotScreen() {
  const { t } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userPhone, setUserPhone] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = useRef(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Welcome message - memoized to prevent recreation
  const welcomeMessage = useRef({
    id: "welcome",
    text: t("chatbot.welcomeMessage"),
    sender: "assistant",
    timestamp: new Date().toISOString(),
  }).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(fadeAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 9,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 60,
        friction: 9,
      }),
    ]).start();

    // Keyboard listeners
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      },
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
      },
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const loadUserData = async () => {
    try {
      const phone = await AsyncStorage.getItem("userPhone");
      if (phone) setUserPhone(phone);

      // Initialize with welcome message if empty
      setMessages([welcomeMessage]);
    } catch (e) {
      console.error("Error loading user data:", e);
      setMessages([welcomeMessage]);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessageText = inputText.trim();
    setInputText("");

    const userMessage = {
      id: Date.now().toString(),
      text: userMessageText,
      sender: "user",
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // Prepare conversation history (exclude welcome message, take last 10)
      const conversationMessages = updatedMessages
        .filter((msg) => msg.id !== "welcome")
        .slice(-10)
        .map((msg) => ({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.text,
        }));

      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          messages: conversationMessages,
          system: `You are a helpful AI assistant for a cow farm management application. You provide expert advice on:
- Cow health and wellness
- Milk production optimization
- Farm management best practices
- Disease prevention and treatment
- Nutrition and feeding
- Breeding and reproduction
- Farm economics and profitability

Always be helpful, accurate, and concise. If asked about serious health issues, recommend consulting a veterinarian. Keep responses under 200 words when possible.`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `API request failed: ${response.status} - ${errorData.error?.message || "Unknown error"}`,
        );
      }

      const responseData = await response.json();

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        text: responseData.content[0].text,
        sender: "assistant",
        timestamp: new Date().toISOString(),
      };

      setMessages([...updatedMessages, assistantMessage]);
    } catch (e) {
      console.error("Chat error:", e);

      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: "I'm sorry, I'm having trouble connecting right now. Please check your internet connection and try again.",
        sender: "assistant",
        timestamp: new Date().toISOString(),
      };

      setMessages([...updatedMessages, errorMessage]);

      Alert.alert(
        t("common.error") || "Error",
        t("chatbot.failedToSendMessage") ||
          "Failed to send message. Please try again.",
        [{ text: "OK", style: "default" }],
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    Alert.alert(
      t("chatbot.clearChat") || "Clear Chat",
      t("chatbot.clearChatConfirm") ||
        "Are you sure you want to clear the conversation?",
      [
        {
          text: t("common.cancel") || "Cancel",
          style: "cancel",
        },
        {
          text: t("chatbot.clear") || "Clear",
          style: "destructive",
          onPress: () => {
            // Reset to just the welcome message
            setMessages([welcomeMessage]);
            setInputText("");
          },
        },
      ],
    );
  };

  const renderMessage = (message, index) => {
    const isUser = message.sender === "user";
    const messageText = message.text || message.content || "";
    const timestamp = message.timestamp || new Date().toISOString();

    return (
      <View
        key={message.id || `msg-${index}`}
        style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAI]}
      >
        {!isUser && (
          <View style={styles.avatarAI}>
            <Ionicons name="sparkles" size={16} color="#ec4899" />
          </View>
        )}

        <View
          style={[
            styles.msgBubble,
            isUser ? styles.msgBubbleUser : styles.msgBubbleAI,
          ]}
        >
          {isUser ? (
            <LinearGradient
              colors={["#ec4899", "#db2777"]}
              style={styles.msgBubbleGradient}
            >
              <Text style={styles.msgTextUser}>{messageText}</Text>
              <Text style={styles.msgTimeUser}>
                {new Date(timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </LinearGradient>
          ) : (
            <LinearGradient
              colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.05)"]}
              style={styles.msgBubbleGradient}
            >
              <Text style={styles.msgTextAI}>{messageText}</Text>
              <Text style={styles.msgTimeAI}>
                {new Date(timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </LinearGradient>
          )}
        </View>

        {isUser && (
          <View style={styles.avatarUser}>
            <Ionicons name="person" size={16} color="#3b82f6" />
          </View>
        )}
      </View>
    );
  };

  const animStyle = {
    opacity: fadeAnim,
    transform: [{ translateY: slideAnim }],
  };

  return (
    <LinearGradient
      colors={["#0f1923", "#142233", "#0d1f2d"]}
      style={styles.gradient}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <SafeAreaView style={styles.safe}>
        <View style={styles.langWrap}>
          <LanguageSelector />
        </View>

        {/* Header */}
        <Animated.View style={[styles.headerRow, animStyle]}>
          <LinearGradient
            colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.04)"]}
            style={styles.headerGlass}
          >
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <View style={styles.headerIconBadge}>
                <Ionicons name="chatbubbles" size={18} color="#ec4899" />
              </View>
              <Text style={styles.headerTitle}>
                {t("chatbot.title") || "AI Assistant"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleClear}
              style={styles.clearBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>

        {/* Chat content */}
        <View style={styles.chatContainer}>
          <KeyboardAvoidingView
            style={styles.chatWrap}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
          >
            <ScrollView
              ref={scrollViewRef}
              style={styles.msgsList}
              contentContainerStyle={styles.msgsContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {messages.map((message, index) => renderMessage(message, index))}

              {isLoading && (
                <View style={styles.loadingWrap}>
                  <View style={styles.avatarAI}>
                    <Ionicons name="sparkles" size={16} color="#ec4899" />
                  </View>
                  <View style={styles.loadingBubble}>
                    <ActivityIndicator size="small" color="#ec4899" />
                    <Text style={styles.loadingText}>
                      {t("chatbot.aiThinking") || "AI is thinking..."}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Input bar */}
            <View style={styles.inputWrap}>
              <LinearGradient
                colors={["rgba(255,255,255,0.08)", "rgba(255,255,255,0.04)"]}
                style={styles.inputBar}
              >
                <TextInput
                  style={styles.input}
                  placeholder={
                    t("chatbot.placeholder") ||
                    "Ask me anything about cow farming..."
                  }
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxLength={500}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.sendBtn}
                  onPress={handleSend}
                  disabled={!inputText.trim() || isLoading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={
                      !inputText.trim() || isLoading
                        ? ["rgba(236,72,153,0.3)", "rgba(219,39,119,0.3)"]
                        : ["#ec4899", "#db2777"]
                    }
                    style={styles.sendBtnGradient}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="send" size={18} color="#fff" />
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0,
  },

  langWrap: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : (StatusBar.currentHeight || 0) + 12,
    right: 16,
    zIndex: 1000,
  },

  // Header
  headerRow: {
    marginHorizontal: 20,
    marginTop: Platform.OS === "ios" ? 60 : (StatusBar.currentHeight || 0) + 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  headerGlass: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  headerIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(236,72,153,0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.25)",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.2,
  },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(239,68,68,0.12)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
  },

  // Chat
  chatContainer: { flex: 1 },
  chatWrap: { flex: 1 },
  msgsList: { flex: 1 },
  msgsContent: {
    padding: 20,
    paddingBottom: 20,
    flexGrow: 1,
  },

  msgRow: {
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  msgRowUser: { justifyContent: "flex-end" },
  msgRowAI: { justifyContent: "flex-start" },

  avatarAI: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(236,72,153,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.25)",
  },
  avatarUser: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(59,130,246,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.25)",
  },

  msgBubble: {
    maxWidth: "70%",
    borderRadius: 18,
    overflow: "hidden",
  },
  msgBubbleUser: {
    borderBottomRightRadius: 4,
  },
  msgBubbleAI: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  msgBubbleGradient: {
    padding: 12,
    paddingHorizontal: 14,
  },

  msgTextUser: {
    fontSize: 15,
    lineHeight: 20,
    color: "#fff",
    fontWeight: "500",
  },
  msgTextAI: {
    fontSize: 15,
    lineHeight: 20,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
  },
  msgTimeUser: {
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    alignSelf: "flex-end",
    marginTop: 4,
  },
  msgTimeAI: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    alignSelf: "flex-end",
    marginTop: 4,
  },

  loadingWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 8,
    marginBottom: 14,
  },
  loadingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  loadingText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    fontStyle: "italic",
    fontWeight: "500",
  },

  // Input
  inputWrap: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: Platform.OS === "ios" ? 20 : 80,
    backgroundColor: "rgba(15,25,35,0.95)",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#fff",
    fontWeight: "500",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
  },
  sendBtnGradient: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
});
