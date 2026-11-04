import type { APIRoute, GetStaticPaths, InferGetStaticPropsType } from "astro";
import { adapter } from "virtual:fumapress/astro";
import { ctx } from "./context";
import { fileStaticPaths } from "./shared";

export const getStaticPaths = (() => fileStaticPaths(ctx, adapter)) satisfies GetStaticPaths;

export const GET: APIRoute<InferGetStaticPropsType<typeof getStaticPaths>> = ({ props, request }) =>
  props.GET(request, { params: props.params });
