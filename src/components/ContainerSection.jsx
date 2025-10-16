import React from "react";
import { Text } from "ink";
import ContainerList from "./ContainerList.jsx";

export default function ContainerSection({ containers, selected }) {
  if (containers.length === 0) {
    return <Text>No containers found</Text>;
  }
  return <ContainerList containers={containers} selected={selected} />;
}
