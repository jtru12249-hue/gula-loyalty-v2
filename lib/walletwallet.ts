headerFields: [
  {
    key: "POINTS",
    label: "POINTS",
    value: String(points),
    changeMessage: "Your GULA balance is now %@ points",
  },
],

primaryFields: [
  {
    key: "REWARD",
    label: "NEXT REWARD",
    value: "FREE REWARD AT 1000 POINTS!",
  },
],

secondaryFields: [
  {
    key: "MEMBER",
    label: "MEMBER",
    value: (name || "GULA Member").toUpperCase(),
  },
],

backFields: [
  {
    key: "MEMBER_ID",
    label: "Member ID",
    value: memberId,
  },
  {
    key: "REWARD_INFO",
    label: "Rewards",
    value: "Earn 10 points for every $1 spent at GULA EXPRESS.",
  },
  {
    key: "FREE_REWARD_INFO",
    label: "Free Reward",
    value: "FREE REWARD AT 1000 POINTS!",
  },
  {
    key: "THANK_YOU",
    label: "Thank you",
    value: "Thanks for being part of GULA EXPRESS.",
  },
],
